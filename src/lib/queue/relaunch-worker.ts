import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getMailer } from "@/lib/mail";
import { dossierRelaunchMail } from "@/lib/mail/auto-templates";
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

  // Plan : tous les jours à 03h00 UTC.
  await boss.schedule(RELAUNCH_QUEUE, "0 3 * * *");

  await boss.work(RELAUNCH_QUEUE, async () => {
    await runRelaunchPass();
  });

  console.info(`[pg-boss] scheduler relance dossiers démarré (cron 0 3 * * *)`);
}

/** Lance manuellement une passe de relance — utile pour tests / cron externe. */
export async function runRelaunchPass(): Promise<{ relaunched: number }> {
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
      participants: {
        where: { role: "COLLABORATOR_PRIMARY" },
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
    for (const p of d.participants) {
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
          console.error("[mail] relance", err);
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
