/**
 * Seed démo « dossier complet » — GRONDIN Jayan.
 *
 * Crée un dossier client de bout en bout pour démontrer toute la plateforme :
 * fiche client renseignée, pièces justificatives déposées, transmission notaire,
 * relances, signature électronique, RDV notaire, facture d'honoraires, notes.
 *
 * Idempotent : ré-exécutable (supprime puis recrée le dossier de démo).
 * Usage : npx tsx prisma/seed-demo-grondin.ts
 */

import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { generatePlaceholderPdf } from "../src/lib/storage/pdf-placeholder";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL manquant dans .env");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const CLIENT_EMAIL = "jayan.grondin@equatisimmobilier.fr";
const DEMO_PASSWORD = "Demo2026!";
const LOT_REF = "GD-DEMO-01";

function s3Client(): S3Client | null {
  const { S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } =
    process.env;
  if (!S3_ENDPOINT || !S3_REGION || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY)
    return null;
  return new S3Client({
    endpoint: S3_ENDPOINT,
    region: S3_REGION,
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
}

async function uploadPdf(
  s3: S3Client | null,
  key: string,
  body: Buffer,
): Promise<boolean> {
  if (!s3 || !process.env.S3_BUCKET) return false;
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: "application/pdf",
      }),
    );
    return true;
  } catch (e) {
    console.warn("  ⚠ Upload S3 échoué pour", key, "—", (e as Error).message);
    return false;
  }
}

async function main() {
  console.log("🌱 Dossier démo complet — GRONDIN Jayan");

  const collab = await prisma.user.findUnique({
    where: { email: "megane@equatisimmobilier.fr" },
  });
  const notary = await prisma.user.findUnique({
    where: { email: "notaire@equatisimmobilier.fr" },
  });
  if (!collab || !notary) {
    throw new Error(
      "Comptes megane@equatisimmobilier.fr et notaire@equatisimmobilier.fr requis — lancer seed-equipe + seed-demo-users.",
    );
  }

  const programme = await prisma.programme.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (!programme) {
    throw new Error(
      "Aucun programme ACTIVE — lancer SEED_DEMO=1 npm run db:seed.",
    );
  }

  // --- Nettoyage d'une exécution précédente ---
  const existingClient = await prisma.user.findUnique({
    where: { email: CLIENT_EMAIL },
  });
  if (existingClient) {
    const oldDossier = await prisma.dossier.findUnique({
      where: { clientId: existingClient.id },
    });
    if (oldDossier)
      await prisma.dossier.delete({ where: { id: oldDossier.id } });
    await prisma.clientProfile.deleteMany({
      where: { userId: existingClient.id },
    });
    await prisma.user.delete({ where: { id: existingClient.id } });
  }
  await prisma.lot.deleteMany({
    where: { programmeId: programme.id, reference: LOT_REF },
  });

  // --- Client + fiche client complète ---
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const client = await prisma.user.create({
    data: {
      email: CLIENT_EMAIL,
      firstName: "Jayan",
      lastName: "GRONDIN",
      role: "CLIENT",
      status: "ACTIVE",
      passwordHash,
      emailVerifiedAt: new Date(),
      clientProfile: {
        create: {
          birthName: "GRONDIN",
          birthDate: new Date("1989-04-12"),
          birthPlace: "Saint-Denis (La Réunion)",
          profession: "Ingénieur logiciel",
          nationality: "Française",
          familyStatus: "MARRIED",
          marriageDate: new Date("2018-06-23"),
          marriagePlace: "Saint-Paul (La Réunion)",
          marriageContract: "Communauté réduite aux acquêts",
        },
      },
    },
  });

  // --- Lot dédié à la démo ---
  const lot = await prisma.lot.create({
    data: {
      programmeId: programme.id,
      reference: LOT_REF,
      surface: new Prisma.Decimal(74.5),
      floor: 3,
      type: "T3",
      priceHT: new Prisma.Decimal(298000),
      vatRate: new Prisma.Decimal(5.5),
      priceTTC: new Prisma.Decimal(298000).times(1.055).toDecimalPlaces(2),
      status: "RESERVED",
    },
  });

  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 24 * 3600_000);

  // --- Dossier ---
  const dossier = await prisma.dossier.create({
    data: {
      programmeId: programme.id,
      clientId: client.id,
      status: "SIGNED_AT_NOTARY",
      contractStatus: "LOAN_OFFER_SENT_TO_NOTARY",
      notaryId: notary.id,
      notaryTransmittedAt: daysAgo(12),
      lastActivityAt: daysAgo(1),
      createdAt: daysAgo(45),
      participants: {
        create: [
          { userId: collab.id, role: "COLLABORATOR_PRIMARY" },
          { userId: notary.id, role: "NOTARY" },
        ],
      },
    },
  });
  await prisma.lot.update({
    where: { id: lot.id },
    data: { dossierId: dossier.id },
  });

  // --- Pièces demandées (toutes fournies) ---
  const requests = await Promise.all(
    [
      { label: "CNI du client", required: true },
      { label: "CNI du conjoint", required: false },
      { label: "Justificatif de domicile", required: true },
    ].map((r) =>
      prisma.documentRequest.create({
        data: { dossierId: dossier.id, ...r, fulfilled: true },
      }),
    ),
  );

  // --- Documents (PDF placeholder uploadés sur S3/MinIO si dispo) ---
  const s3 = s3Client();
  const docSpecs = [
    {
      name: "CNI-Jayan-GRONDIN.pdf",
      reqIdx: 0,
      source: "CLIENT_UPLOAD" as const,
    },
    { name: "CNI-conjoint.pdf", reqIdx: 1, source: "CLIENT_UPLOAD" as const },
    {
      name: "Justificatif-domicile.pdf",
      reqIdx: 2,
      source: "CLIENT_UPLOAD" as const,
    },
    {
      name: "Contrat-reservation-signe.pdf",
      reqIdx: -1,
      source: "YOUSIGN_SIGNED" as const,
    },
  ];
  let signedDocId: string | null = null;
  for (const spec of docSpecs) {
    const storageKey = `dossiers/${dossier.id}/${randomUUID()}`;
    const pdf = generatePlaceholderPdf({
      programmeName: programme.name,
      lotReference: lot.reference,
      signerName: "Jayan GRONDIN",
    });
    await uploadPdf(s3, storageKey, pdf);
    const doc = await prisma.document.create({
      data: {
        dossierId: dossier.id,
        uploadedById: spec.source === "CLIENT_UPLOAD" ? client.id : collab.id,
        fileName: spec.name,
        mimeType: "application/pdf",
        sizeBytes: pdf.byteLength,
        storageKey,
        source: spec.source,
        scanStatus: "CLEAN",
        scanCheckedAt: new Date(),
        documentRequestId: spec.reqIdx >= 0 ? requests[spec.reqIdx]!.id : null,
      },
    });
    if (spec.source === "YOUSIGN_SIGNED") signedDocId = doc.id;
  }

  // --- Timeline détaillée ---
  const timeline: {
    kind: Prisma.TimelineEventCreateManyDossierInput["kind"];
    title: string;
    description?: string;
    occurredAt: Date;
  }[] = [
    {
      kind: "LEAD_CREATED",
      title: "Dossier créé",
      description: "Prospect qualifié — issu du formulaire Google Forms.",
      occurredAt: daysAgo(45),
    },
    {
      kind: "COMMERCIAL_MEETING",
      title: "Rendez-vous commercial",
      description: "Présentation du programme et du lot T3.",
      occurredAt: daysAgo(40),
    },
    {
      kind: "RESERVATION_SENT",
      title: "Contrat de réservation envoyé",
      occurredAt: daysAgo(35),
    },
    {
      kind: "DOCUMENT_REQUESTED",
      title: "Pièces justificatives demandées",
      description: "CNI client, CNI conjoint, justificatif de domicile.",
      occurredAt: daysAgo(34),
    },
    {
      kind: "RESERVATION_SIGNED",
      title: "Contrat de réservation signé électroniquement",
      occurredAt: daysAgo(28),
    },
    {
      kind: "OPTION_REMINDER",
      title: "Relance client effectuée",
      description: "Relance pour l'obtention de l'offre de prêt.",
      occurredAt: daysAgo(20),
    },
    {
      kind: "TRANSMITTED_TO_NOTARY",
      title: "Dossier transmis au notaire",
      occurredAt: daysAgo(12),
    },
    {
      kind: "CONTRACT_STATUS_CHANGE",
      title: "Contrat → Offre de prêt reçue",
      occurredAt: daysAgo(8),
    },
    {
      kind: "CONTRACT_STATUS_CHANGE",
      title: "Contrat → Offre de prêt envoyée au notaire — en attente de RDV",
      occurredAt: daysAgo(4),
    },
    {
      kind: "APPOINTMENT_SCHEDULED",
      title: "Rendez-vous notaire planifié",
      occurredAt: daysAgo(2),
    },
    {
      kind: "INVOICE_SENT",
      title: "Facture d'honoraires transmise au notaire",
      occurredAt: daysAgo(1),
    },
  ];
  await prisma.timelineEvent.createMany({
    data: timeline.map((t) => ({
      dossierId: dossier.id,
      kind: t.kind,
      title: t.title,
      description: t.description ?? null,
      occurredAt: t.occurredAt,
      actorId: collab.id,
    })),
  });

  // --- Signature électronique (réservation signée) ---
  await prisma.signature.create({
    data: {
      dossierId: dossier.id,
      documentId: signedDocId,
      yousignProcedureId: `demo-${randomUUID()}`,
      status: "SIGNED",
      signerEmail: client.email,
      signerUserId: client.id,
      createdAt: daysAgo(30),
      signedAt: daysAgo(28),
    },
  });

  // --- RDV notaire à venir ---
  await prisma.appointment.create({
    data: {
      dossierId: dossier.id,
      scheduledAt: new Date(now + 9 * 24 * 3600_000),
      location: "Étude de Me Rousseau — 12 rue de la République, Saint-Denis",
      notes: "Signature de l'acte authentique de vente.",
      notaryId: notary.id,
      createdById: collab.id,
      status: "CONFIRMED",
    },
  });

  // --- Facture d'honoraires (transmise au notaire) ---
  await prisma.invoice.create({
    data: {
      dossierId: dossier.id,
      number: "HON-2026-GRONDIN",
      amountHT: new Prisma.Decimal(4500),
      amountTTC: new Prisma.Decimal(5400),
      status: "SENT_TO_NOTARY",
      sentToNotaryAt: daysAgo(1),
      createdById: collab.id,
    },
  });

  // --- Notes partagées de l'équipe ---
  await prisma.note.createMany({
    data: [
      {
        scope: "DOSSIER",
        dossierId: dossier.id,
        authorId: collab.id,
        body: "Client très réactif. Apport personnel de 60 000 €, financement BNP en cours.",
      },
      {
        scope: "DOSSIER",
        dossierId: dossier.id,
        authorId: collab.id,
        body: "Offre de prêt reçue le mois dernier, transmise au notaire. RDV de signature calé.",
      },
    ],
  });

  // --- Messagerie ---
  await prisma.message.createMany({
    data: [
      {
        dossierId: dossier.id,
        senderId: collab.id,
        body: "Bonjour M. GRONDIN, votre dossier est transmis au notaire. Je reviens vers vous pour le RDV de signature.",
        createdAt: daysAgo(11),
        readBy: [client.id],
      },
      {
        dossierId: dossier.id,
        senderId: client.id,
        body: "Merci beaucoup ! Je suis disponible la semaine prochaine pour le rendez-vous.",
        createdAt: daysAgo(10),
        readBy: [collab.id],
      },
      {
        dossierId: dossier.id,
        senderId: collab.id,
        body: "Parfait, le RDV est confirmé. Vous recevrez la convocation par email.",
        createdAt: daysAgo(2),
      },
    ],
  });

  // --- Notifications pour le collaborateur et le client ---
  await prisma.notification.createMany({
    data: [
      {
        userId: collab.id,
        kind: "APPOINTMENT_SCHEDULED",
        title: "RDV notaire confirmé — dossier Jayan GRONDIN",
        body: "Facturation : honoraires à préparer.",
        link: "/collaborateur/facturation",
      },
      {
        userId: client.id,
        kind: "APPOINTMENT_SCHEDULED",
        title: "Votre rendez-vous notaire est planifié",
        body: "Signature de l'acte authentique — voir votre espace.",
        link: "/client",
      },
    ],
  });

  console.log(`✓ Dossier créé pour Jayan GRONDIN`);
  console.log(`  Programme : ${programme.name} · Lot ${lot.reference}`);
  console.log(`  Collaboratrice : Mégane · Notaire : Hélène Rousseau`);
  console.log(`  Connexion client : ${CLIENT_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed GRONDIN échoué :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
