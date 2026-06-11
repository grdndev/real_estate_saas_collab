import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getMailer } from "@/lib/mail";
import {
  dossierRelaunchMail,
  notaryRelaunchMail,
} from "@/lib/mail/auto-templates";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import { getQueue } from "@/lib/queue";

const RELAUNCH_QUEUE = "dossier-relaunch";
let started = false;

/** Démarre le scheduler pg-boss qui exécute la relance auto chaque jour à 03h. */
export async function startRelaunchScheduler(): Promise<void> {
  if (started) return;
  started = true;

  const boss = await getQueue();
  await boss.createQueue(RELAUNCH_QUEUE);
  await boss.schedule(RELAUNCH_QUEUE, "* * * * *");
  await boss.work(RELAUNCH_QUEUE, async () => {
    await runRelaunchPass();
  });

  console.info(`[pg-boss] scheduler relance dossiers`);
}

/** Lance manuellement une passe de relance — utile pour tests / cron externe. */
export async function runRelaunchPass(): Promise<{ relaunched: number }> {
  console.info(`[pg-boss] passe de relance automatique démarrée`);

  const settings = await getSettings();
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - settings.RELAUNCH_DELAY_DAYS);

  const dossiers = await prisma.dossier.findMany({
    where: {
      closedAt: null,
      lastActivityAt: { lt: threshold },
    },
    select: {
      id: true,
      reference: true,
      lastActivityAt: true,
      programme: { select: { name: true } },
      participants: {
        include: {
          user: { select: { id: true, email: true, firstName: true } },
        },
      },
    },
  });

  let relaunched = 0;
  for (const d of dossiers) {
    const days = Math.max(
      1,
      Math.round(
        (Date.now() - d.lastActivityAt.getTime()) / (24 * 3600 * 1000),
      ),
    );

    if (days > 14) {
      for (const n of d.participants.filter((p) => p.role === "NOTARY")) {
        await notify({
          userId: n.user.id,
          kind: "DOSSIER_INACTIVE",
          title: `Dossier inactif : ${d.reference}`,
          body: `${days} jours sans activité.`,
          link: `/notaire/dossiers/${d.id}`,
        });
        // Email
        if (settings.AUTO_EMAILS_ENABLED) {
          try {
            await getMailer().send(
              notaryRelaunchMail(
                n.user.email,
                n.user.firstName,
                d.reference,
                d.programme.name,
                days,
              ),
            );
          } catch (err) {
            console.error("[mail] relance échouée", n.user.email, err);
          }
        }
      }
    }

    for (const p of d.participants.filter(
      (p) => p.role === "COLLABORATOR_PRIMARY",
    )) {
      // Notification in-app
      await notify({
        userId: p.user.id,
        kind: "DOSSIER_INACTIVE",
        title: `Dossier inactif : ${d.reference}`,
        body: `${days} jours sans activité.`,
        link: `/collaborateur/dossiers/${d.id}`,
      });
      // Email
      if (settings.AUTO_EMAILS_ENABLED) {
        try {
          await getMailer().send(
            dossierRelaunchMail(
              p.user.email,
              p.user.firstName,
              d.reference,
              days,
            ),
          );
        } catch (err) {
          console.error("[mail] relance échouée", p.user.email, err);
        }
      }
    }

    await audit({
      action: "DOSSIER_UPDATED",
      resourceType: "Dossier",
      resourceId: d.id,
      metadata: { step: "auto_relaunch", days },
    });
    relaunched++;
  }

  return { relaunched };
}
