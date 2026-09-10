import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import { getQueue } from "@/lib/queue";

const OPTION_EXPIRY_QUEUE = "option-expiry";
let started = false;

/** Démarre le scheduler pg-boss qui purge les options échues chaque jour à 04h. */
export async function startOptionExpiryScheduler(): Promise<void> {
  if (started) return;
  started = true;

  const boss = await getQueue();
  await boss.createQueue(OPTION_EXPIRY_QUEUE);
  await boss.schedule(OPTION_EXPIRY_QUEUE, "0 4 * * *");
  await boss.work(OPTION_EXPIRY_QUEUE, async () => {
    await runOptionExpiryPass();
  });

  console.info(`[pg-boss] scheduler expiration des options`);
}

/**
 * Libère les lots dont l'option est arrivée à échéance.
 *
 * Le critère est le statut du lot : tant qu'il est `OPTIONED`, l'option n'a
 * été ni confirmée (passage du dossier en réservé, qui purge l'option) ni
 * levée. Le client reste associé au lot — seul l'engagement commercial tombe.
 */
export async function runOptionExpiryPass(): Promise<{ expired: number }> {
  const dossiers = await prisma.dossier.findMany({
    where: {
      optioned: true,
      optionExpiresAt: { lt: new Date() },
      archivedAt: null,
      lot: { is: { status: "OPTIONED" } },
    },
    select: {
      id: true,
      lotId: true,
      optionExpiresAt: true,
      lot: { select: { reference: true } },
      participants: {
        where: { role: "COLLABORATOR_PRIMARY" },
        select: { userId: true },
      },
    },
  });

  for (const d of dossiers) {
    await prisma.$transaction(async (tx) => {
      await tx.dossier.update({
        where: { id: d.id },
        data: { optioned: false, optionExpiresAt: null },
      });
      await tx.lot.update({
        where: { id: d.lotId },
        data: { status: "AVAILABLE" },
      });
      await tx.timelineEvent.create({
        data: {
          dossierId: d.id,
          kind: "OPTION_TAKEN",
          title: "Option expirée — lot remis à disposition",
          description: d.optionExpiresAt
            ? `Échéance du ${d.optionExpiresAt.toLocaleDateString("fr-FR")} dépassée`
            : null,
        },
      });
    });

    for (const p of d.participants) {
      await notify({
        userId: p.userId,
        kind: "OPTION_REMINDER",
        title: `Option expirée — lot ${d.lot.reference}`,
        body: "L'option est arrivée à échéance : le lot est de nouveau disponible.",
        link: `/collaborateur/lots/${d.lotId}`,
      });
    }

    await audit({
      action: "DOSSIER_UPDATED",
      resourceType: "Dossier",
      resourceId: d.id,
      metadata: `Option expirée — lot ${d.lot.reference} repassé disponible`,
    });
  }

  if (dossiers.length > 0) {
    console.info(`[pg-boss] ${dossiers.length} option(s) expirée(s)`);
  }
  return { expired: dossiers.length };
}
