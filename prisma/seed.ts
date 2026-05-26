/**
 * Seed Équatis — création de l'utilisateur Super Admin initial
 * et de quelques données de démo (programmes + lots).
 *
 * Idempotent : peut être lancé plusieurs fois sans dupliquer.
 *
 * Usage : pnpm db:seed
 *
 * Variables optionnelles :
 *   SEED_ADMIN_EMAIL    (défaut : admin@equatis.fr)
 *   SEED_ADMIN_PASSWORD (défaut : Equatis2026!)
 *   SEED_DEMO           (=1 pour créer programmes/lots de démo)
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@equatis.fr";
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Equatis2026!";
const seedDemo = process.env.SEED_DEMO === "1";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL manquant dans .env");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function ensureSuperAdmin() {
  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
  });
  if (existing) {
    console.log(`✓ Super Admin déjà présent : ${adminEmail}`);
    return existing;
  }
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      firstName: "Super",
      lastName: "Admin",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`✓ Super Admin créé : ${admin.email}`);
  console.log(`  Mot de passe : ${adminPassword}`);
  console.log(`  ⚠️  Changez-le immédiatement à votre première connexion.`);
  return admin;
}

async function ensureDefaultSettings() {
  const defaults: Array<{ key: string; value: string }> = [
    { key: "RELAUNCH_DELAY_DAYS", value: "7" },
    { key: "SESSION_INACTIVITY_MINUTES", value: "30" },
    { key: "AUTO_EMAILS_ENABLED", value: "true" },
  ];
  for (const s of defaults) {
    await prisma.setting.upsert({
      where: { key: s.key },
      create: s,
      update: {},
    });
  }
  console.log(`✓ Paramètres par défaut en place`);
}

async function ensureDemoProgrammes() {
  if (!seedDemo) return;

  const antares = await prisma.programme.upsert({
    where: { reference: "ANTARES" },
    create: {
      reference: "ANTARES",
      name: "Résidence Antarès",
      description:
        "Programme neuf de 18 logements en cœur de ville. Livraison T4 2027.",
      city: "Lyon",
      caObjective: new Prisma.Decimal(5_400_000),
    },
    update: {},
  });

  const lots = [
    {
      reference: "A101",
      surface: 48,
      floor: 1,
      type: "T2",
      priceHT: 185_000,
      vatRate: 5.5,
    },
    {
      reference: "A102",
      surface: 62,
      floor: 1,
      type: "T3",
      priceHT: 240_000,
      vatRate: 5.5,
    },
    {
      reference: "A201",
      surface: 75,
      floor: 2,
      type: "T3",
      priceHT: 295_000,
      vatRate: 20,
    },
  ];
  for (const l of lots) {
    await prisma.lot.upsert({
      where: {
        programmeId_reference: {
          programmeId: antares.id,
          reference: l.reference,
        },
      },
      create: {
        programmeId: antares.id,
        reference: l.reference,
        surface: new Prisma.Decimal(l.surface),
        floor: l.floor,
        type: l.type,
        priceHT: new Prisma.Decimal(l.priceHT),
        vatRate: new Prisma.Decimal(l.vatRate),
        priceTTC: new Prisma.Decimal(l.priceHT * (1 + l.vatRate / 100)),
        status: "AVAILABLE",
      },
      update: {},
    });
  }
  await prisma.programme.update({
    where: { id: antares.id },
    data: { totalLots: lots.length },
  });

  console.log(`✓ Programme de démo "Antarès" + ${lots.length} lots`);
}

async function ensureClientProgrammes() {
  if (!seedDemo) return;

  const programmes = [
    {
      reference: "DUPARC",
      name: "Le Duparc",
      city: "Annecy",
      description: "Résidence Le Duparc — programme résidentiel premium.",
      caObjective: 8_200_000,
      lots: [
        {
          reference: "D101",
          surface: 45,
          floor: 1,
          type: "T2",
          priceHT: 245_000,
          vatRate: 20,
        },
        {
          reference: "D102",
          surface: 62,
          floor: 1,
          type: "T3",
          priceHT: 325_000,
          vatRate: 20,
        },
        {
          reference: "D201",
          surface: 78,
          floor: 2,
          type: "T3",
          priceHT: 395_000,
          vatRate: 20,
        },
        {
          reference: "D301",
          surface: 95,
          floor: 3,
          type: "T4",
          priceHT: 485_000,
          vatRate: 20,
        },
      ],
    },
    {
      reference: "ANTERES",
      name: "Antérès",
      city: "Lyon",
      description: "Programme Antérès — 24 logements en accession.",
      caObjective: 6_800_000,
      lots: [
        {
          reference: "AN101",
          surface: 42,
          floor: 1,
          type: "T2",
          priceHT: 198_000,
          vatRate: 5.5,
        },
        {
          reference: "AN102",
          surface: 58,
          floor: 1,
          type: "T3",
          priceHT: 268_000,
          vatRate: 5.5,
        },
        {
          reference: "AN201",
          surface: 72,
          floor: 2,
          type: "T3",
          priceHT: 312_000,
          vatRate: 5.5,
        },
        {
          reference: "AN202",
          surface: 88,
          floor: 2,
          type: "T4",
          priceHT: 385_000,
          vatRate: 5.5,
        },
      ],
    },
    {
      reference: "SAINTE_MARIE",
      name: "Sainte Marie",
      city: "Grenoble",
      description:
        "Résidence Sainte Marie — programme mixte accession + investissement.",
      caObjective: 4_500_000,
      lots: [
        {
          reference: "SM101",
          surface: 38,
          floor: 1,
          type: "T1",
          priceHT: 145_000,
          vatRate: 20,
        },
        {
          reference: "SM102",
          surface: 52,
          floor: 1,
          type: "T2",
          priceHT: 215_000,
          vatRate: 20,
        },
        {
          reference: "SM201",
          surface: 68,
          floor: 2,
          type: "T3",
          priceHT: 285_000,
          vatRate: 20,
        },
      ],
    },
  ];

  // Assigne au compte promoteur démo si présent.
  const promoter = await prisma.user.findUnique({
    where: { email: "promoteur@equatis.fr" },
  });

  for (const prog of programmes) {
    const created = await prisma.programme.upsert({
      where: { reference: prog.reference },
      create: {
        reference: prog.reference,
        name: prog.name,
        description: prog.description,
        city: prog.city,
        caObjective: new Prisma.Decimal(prog.caObjective),
      },
      update: {},
    });
    for (const l of prog.lots) {
      await prisma.lot.upsert({
        where: {
          programmeId_reference: {
            programmeId: created.id,
            reference: l.reference,
          },
        },
        create: {
          programmeId: created.id,
          reference: l.reference,
          surface: new Prisma.Decimal(l.surface),
          floor: l.floor,
          type: l.type,
          priceHT: new Prisma.Decimal(l.priceHT),
          vatRate: new Prisma.Decimal(l.vatRate),
          priceTTC: new Prisma.Decimal(l.priceHT * (1 + l.vatRate / 100)),
          status: "AVAILABLE",
        },
        update: {},
      });
    }
    await prisma.programme.update({
      where: { id: created.id },
      data: { totalLots: prog.lots.length },
    });
    if (promoter) {
      await prisma.programmePromoter.upsert({
        where: {
          programmeId_promoterId: {
            programmeId: created.id,
            promoterId: promoter.id,
          },
        },
        create: { programmeId: created.id, promoterId: promoter.id },
        update: {},
      });
    }
    console.log(`✓ Programme "${prog.name}" + ${prog.lots.length} lots`);
  }
}

async function main() {
  console.log("🌱 Seeding Équatis…");
  await ensureSuperAdmin();
  await ensureDefaultSettings();
  await ensureDemoProgrammes();
  await ensureClientProgrammes();
  console.log("✓ Seed terminé");
}

main()
  .catch((e) => {
    console.error("❌ Seed échoué :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
