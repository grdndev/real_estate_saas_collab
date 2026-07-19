/**
 * Seed démo — crée 4 comptes (1 par rôle) avec mots de passe connus
 * pour faciliter la démo locale. À NE PAS utiliser en production.
 *
 * Usage : npx tsx prisma/seed-demo-users.ts
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const DEMO_PASSWORD = "Demo2026!";
const COST = 12;

interface DemoUser {
  email: string;
  firstName: string;
  lastName: string;
  role: "COLLABORATOR" | "PROMOTER" | "NOTARY" | "CLIENT";
}

const USERS: DemoUser[] = [
  {
    email: "collab@equatisimmobilier.fr",
    firstName: "Sophie",
    lastName: "Martin",
    role: "COLLABORATOR",
  },
  {
    email: "promoteur@equatisimmobilier.fr",
    firstName: "Marc",
    lastName: "Dubois",
    role: "PROMOTER",
  },
  {
    email: "notaire@equatisimmobilier.fr",
    firstName: "Hélène",
    lastName: "Rousseau",
    role: "NOTARY",
  },
  {
    email: "client@equatisimmobilier.fr",
    firstName: "Julie",
    lastName: "Bernard",
    role: "CLIENT",
  },
];

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL manquant dans .env");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  console.log(
    "🌱 Création des 4 comptes démo (mot de passe : " + DEMO_PASSWORD + ")",
  );
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, COST);

  for (const u of USERS) {
    const existing = await prisma.user.findUnique({
      where: { email: u.email },
    });
    if (existing) {
      // Met à jour le hash + status pour s'assurer que le compte est utilisable.
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          status: u.role === "CLIENT" ? "PENDING_ASSOCIATION" : "ACTIVE",
          emailVerifiedAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      console.log(`  ↻ ${u.role.padEnd(13)} ${u.email} (mis à jour)`);
    } else {
      await prisma.user.create({
        data: {
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          passwordHash,
          status: u.role === "CLIENT" ? "PENDING_ASSOCIATION" : "ACTIVE",
          emailVerifiedAt: new Date(),
        },
      });
      console.log(`  + ${u.role.padEnd(13)} ${u.email}`);
    }
  }

  // Assigner le promoteur à tous les programmes ACTIVE.
  const promoter = await prisma.user.findUnique({
    where: { email: "promoteur@equatisimmobilier.fr" },
  });
  if (promoter) {
    const programmes = await prisma.programme.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
    });
    for (const p of programmes) {
      await prisma.programmePromoter.upsert({
        where: {
          programmeId_promoterId: {
            programmeId: p.id,
            promoterId: promoter.id,
          },
        },
        create: { programmeId: p.id, promoterId: promoter.id },
        update: {},
      });
      console.log(`  ✓ Promoteur assigné à "${p.name}"`);
    }
  }

  console.log(
    "\n✓ Comptes démo prêts.\n  Connexion : http://localhost:3000/connexion\n  Mot de passe (tous) : " +
      DEMO_PASSWORD,
  );
}

main()
  .catch((e) => {
    console.error("❌ Seed démo échoué :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
