/**
 * Met à jour quelques statuts de lots pour rendre la trésorerie
 * auto-calculée visuelle dès la démo (mix vendus / réservés / dispo).
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
  const updates: Array<{
    programmeRef: string;
    reference: string;
    status: "SOLD" | "RESERVED" | "AVAILABLE";
  }> = [
    { programmeRef: "DUPARC", reference: "D101", status: "SOLD" },
    { programmeRef: "DUPARC", reference: "D102", status: "RESERVED" },
    // D201, D301 restent AVAILABLE
    { programmeRef: "ANTERES", reference: "AN101", status: "SOLD" },
    { programmeRef: "ANTERES", reference: "AN102", status: "SOLD" },
    { programmeRef: "ANTERES", reference: "AN201", status: "RESERVED" },
    // AN202 reste AVAILABLE
    { programmeRef: "SAINTE_MARIE", reference: "SM101", status: "RESERVED" },
    // SM102, SM201 restent AVAILABLE
  ];

  let touched = 0;
  for (const u of updates) {
    const prog = await prisma.programme.findUnique({
      where: { reference: u.programmeRef },
      select: { id: true },
    });
    if (!prog) continue;
    const r = await prisma.lot.updateMany({
      where: { programmeId: prog.id, reference: u.reference },
      data: { status: u.status },
    });
    touched += r.count;
  }
  console.log(`✓ ${touched} statut(s) de lot mis à jour`);
}

main()
  .catch((e) => {
    console.error("❌ Échec :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
