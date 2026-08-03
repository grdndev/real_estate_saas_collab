/**
 * Seed démo dossier : crée un dossier réaliste avec
 * client + collaborateur + lot + timeline + pièces demandées + message.
 * Permet à l'utilisateur de voir l'interface collab pleine dès le login.
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL manquant dans .env");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  console.log("🌱 Création d'un dossier de démo…");

  const [collab, client, programme] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { email: "collab@equatisimmobilier.fr" },
    }),
    prisma.user.findUniqueOrThrow({
      where: { email: "client@equatisimmobilier.fr" },
    }),
    prisma.programme.findUniqueOrThrow({
      where: { name: "Résidence Antarès" },
    }),
  ]);
  const lot = await prisma.lot.findFirst({
    where: { programmeId: programme.id, reference: "A102" },
  });
  if (!lot)
    throw new Error(
      "Lot A102 introuvable — relancer SEED_DEMO=1 npm run db:seed",
    );

  // Skip si client déjà associé.
  const existing = await prisma.dossier.findFirst({
    where: { clientId: client.id, archivedAt: null },
  });
  if (existing) {
    console.log("  ↻ Dossier existant pour le client démo — skip");
    await prisma.$disconnect();
    return;
  }

  const dossier = await prisma.$transaction(async (tx) => {
    const created = await tx.dossier.create({
      data: {
        programmeId: programme.id,
        clientId: client.id,
        status: "RESERVATION_SENT",
        lastActivityAt: new Date(),
      },
    });
    await tx.dossierParticipant.create({
      data: {
        dossierId: created.id,
        userId: collab.id,
        role: "COLLABORATOR_PRIMARY",
      },
    });
    await tx.lot.update({
      where: { id: lot.id },
      data: { dossierId: created.id, status: "RESERVED" },
    });
    await tx.user.update({
      where: { id: client.id },
      data: { status: "ACTIVE" },
    });

    // Timeline réaliste
    const events = [
      { kind: "LEAD_CREATED", title: "Dossier créé", offsetDays: -14 },
      {
        kind: "COMMERCIAL_MEETING",
        title: "Rendez-vous commercial",
        offsetDays: -10,
      },
      {
        kind: "RESERVATION_SENT",
        title: "Contrat de réservation envoyé",
        offsetDays: -3,
      },
    ] as const;
    for (const ev of events) {
      const at = new Date();
      at.setDate(at.getDate() + ev.offsetDays);
      await tx.timelineEvent.create({
        data: {
          dossierId: created.id,
          kind: ev.kind,
          title: ev.title,
          actorId: collab.id,
          occurredAt: at,
          createdAt: at,
        },
      });
    }

    // Pièces demandées
    const pieces = [
      { label: "Pièce d'identité (recto)", required: true },
      { label: "Pièce d'identité (verso)", required: true },
      { label: "Justificatif de domicile (< 3 mois)", required: true },
      { label: "Offre de prêt bancaire", required: false },
    ];
    for (const p of pieces) {
      await tx.documentRequest.create({
        data: {
          dossierId: created.id,
          label: p.label,
          required: p.required,
        },
      });
    }

    // Message
    await tx.message.create({
      data: {
        dossierId: created.id,
        senderId: collab.id,
        body: "Bonjour Julie, bienvenue ! N'hésitez pas à déposer les pièces demandées dès que possible pour accélérer le traitement. À votre disposition.",
      },
    });

    return created;
  });

  console.log(
    `\n✓ Dossier démo créé\n  Lot A102 — Résidence Antarès\n  Client : Julie Bernard\n  Collab : Sophie Martin\n  Statut : RESERVATION_SENT\n`,
  );
  void dossier;
}

main()
  .catch((e) => {
    console.error("❌ Seed dossier échoué :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
