/**
 * Seed équipe Équatis — comptes réels des 2 promoteurs et 2 collaboratrices.
 *
 * Usage : pnpm tsx prisma/seed-equipe.ts
 *
 * Mot de passe initial commun : Equatis2026!  (à changer à la première connexion)
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const INITIAL_PASSWORD = "Equatis2026!";
const COST = 12;

interface TeamUser {
  email: string;
  firstName: string;
  lastName: string;
  role: "COLLABORATOR" | "PROMOTER";
}

const USERS: TeamUser[] = [
  {
    email: "christian.virapatrin@equatis.fr",
    firstName: "Christian",
    lastName: "Virapatrin",
    role: "PROMOTER",
  },
  {
    email: "nathalie.ichane@equatis.fr",
    firstName: "Nathalie",
    lastName: "Ichane",
    role: "PROMOTER",
  },
  {
    email: "megane@equatis.fr",
    firstName: "Mégane",
    lastName: "Collaboratrice",
    role: "COLLABORATOR",
  },
  {
    email: "sylvie@equatis.fr",
    firstName: "Sylvie",
    lastName: "Collaboratrice",
    role: "COLLABORATOR",
  },
];

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL manquant dans .env");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  console.log("🌱 Création des comptes équipe Équatis…");
  const passwordHash = await bcrypt.hash(INITIAL_PASSWORD, COST);

  for (const u of USERS) {
    const existing = await prisma.user.findUnique({
      where: { email: u.email },
    });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      console.log(
        `  ↻ ${u.role.padEnd(13)} ${u.firstName} ${u.lastName} (mis à jour)`,
      );
    } else {
      await prisma.user.create({
        data: {
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          passwordHash,
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
        },
      });
      console.log(`  + ${u.role.padEnd(13)} ${u.firstName} ${u.lastName}`);
    }
  }

  console.log(
    `\n✓ Comptes équipe prêts.\n  Connexion : http://localhost:3000/connexion\n  Mot de passe initial (tous) : ${INITIAL_PASSWORD}`,
  );
}

main()
  .catch((e) => {
    console.error("❌ Seed équipe échoué :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
