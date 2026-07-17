/**
 * Seed démo prospects — simule un import Google Forms réaliste
 * pour montrer la section Prospects dès la première connexion.
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
  console.log("🌱 Création de prospects de démo…");

  const collab = await prisma.user.findUnique({
    where: { email: "collab@equatisimmobilier.fr" },
  });

  const programmes = await prisma.programme.findMany({
    where: {
      reference: { in: ["DUPARC", "ANTERES", "SAINTE_MARIE"] },
    },
    select: { id: true, reference: true },
  });
  const byRef = new Map(programmes.map((p) => [p.reference, p.id]));

  const prospects: Array<{
    firstName: string;
    lastName: string;
    email: string;
    city: string;
    phone: string;
    programmeRef?: string;
    source: string;
    status: "NEW" | "QUALIFIED" | "OPTIONED";
  }> = [
    {
      firstName: "Camille",
      lastName: "Lefèvre",
      email: "camille.lefevre@example.com",
      city: "Annecy",
      phone: "06 12 34 56 78",
      programmeRef: "DUPARC",
      source: "google_forms",
      status: "NEW",
    },
    {
      firstName: "Thomas",
      lastName: "Bernard",
      email: "thomas.bernard@example.com",
      city: "Annecy-le-Vieux",
      phone: "06 23 45 67 89",
      programmeRef: "DUPARC",
      source: "google_forms",
      status: "QUALIFIED",
    },
    {
      firstName: "Sophie",
      lastName: "Roche",
      email: "sophie.roche@example.com",
      city: "Lyon 6e",
      phone: "06 34 56 78 90",
      programmeRef: "ANTERES",
      source: "google_forms",
      status: "QUALIFIED",
    },
    {
      firstName: "Marc",
      lastName: "Dubois",
      email: "marc.dubois@example.com",
      city: "Villeurbanne",
      phone: "06 45 67 89 01",
      programmeRef: "ANTERES",
      source: "google_forms",
      status: "NEW",
    },
    {
      firstName: "Laure",
      lastName: "Mercier",
      email: "laure.mercier@example.com",
      city: "Grenoble",
      phone: "06 56 78 90 12",
      programmeRef: "SAINTE_MARIE",
      source: "google_forms",
      status: "QUALIFIED",
    },
    {
      firstName: "Julien",
      lastName: "Faure",
      email: "julien.faure@example.com",
      city: "Meylan",
      phone: "06 67 89 01 23",
      programmeRef: "SAINTE_MARIE",
      source: "salon_immobilier",
      status: "NEW",
    },
    {
      firstName: "Aurélie",
      lastName: "Petit",
      email: "aurelie.petit@example.com",
      city: "Chambéry",
      phone: "06 78 90 12 34",
      source: "recommandation",
      status: "NEW",
    },
  ];

  let added = 0;
  let skipped = 0;
  for (const p of prospects) {
    const programmeId = p.programmeRef
      ? (byRef.get(p.programmeRef) ?? null)
      : null;
    try {
      await prisma.prospect.create({
        data: {
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          phone: p.phone,
          city: p.city,
          programmeId,
          source: p.source,
          status: p.status,
          ownerId: collab?.id ?? null,
        },
      });
      added++;
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === "P2002") {
        skipped++;
        continue;
      }
      throw e;
    }
  }
  console.log(
    `✓ ${added} prospect(s) ajouté(s), ${skipped} doublon(s) ignoré(s)`,
  );
}

main()
  .catch((e) => {
    console.error("❌ Seed prospects échoué :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
