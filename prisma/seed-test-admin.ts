import "dotenv/config";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const prog = await prisma.programme.upsert({
    where: { name: "Les Jardins de Bellevue" },
    create: {
      name: "Les Jardins de Bellevue",
      description:
        "Programme test : 8 logements, 2 bâtiments. Livraison T2 2028.",
      address: "12 rue des Lilas",
      zipcode: "97400",
      city: "Saint-Denis",
      status: "ACTIVE",
      caObjective: new Prisma.Decimal(2_100_000),
    },
    update: {},
  });

  const lots = [
    {
      reference: "B101",
      building: "A",
      floor: 0,
      type: "T2",
      surface: 45,
      priceHT: 168_000,
      vatRate: 5.5,
      status: "SOLD",
      garden: 30,
    },
    {
      reference: "B102",
      building: "A",
      floor: 0,
      type: "T3",
      surface: 64,
      priceHT: 225_000,
      vatRate: 5.5,
      status: "RESERVED",
      garden: 45,
    },
    {
      reference: "B201",
      building: "A",
      floor: 1,
      type: "T2",
      surface: 47,
      priceHT: 172_000,
      vatRate: 20,
      status: "OPTIONED",
    },
    {
      reference: "B202",
      building: "A",
      floor: 1,
      type: "T4",
      surface: 82,
      priceHT: 298_000,
      vatRate: 20,
      status: "AVAILABLE",
    },
    {
      reference: "C101",
      building: "B",
      floor: 0,
      type: "T1",
      surface: 31,
      priceHT: 124_000,
      vatRate: 5.5,
      status: "AVAILABLE",
      garden: 20,
    },
    {
      reference: "C102",
      building: "B",
      floor: 0,
      type: "T3",
      surface: 66,
      priceHT: 232_000,
      vatRate: 20,
      status: "SOLD",
    },
    {
      reference: "C201",
      building: "B",
      floor: 1,
      type: "T3",
      surface: 68,
      priceHT: 240_000,
      vatRate: 20,
      status: "AVAILABLE",
    },
    {
      reference: "C202",
      building: "B",
      floor: 1,
      type: "T5",
      surface: 104,
      priceHT: 385_000,
      vatRate: 20,
      status: "WITHDRAWN",
    },
  ] as const;

  for (const l of lots) {
    const data = {
      surface: new Prisma.Decimal(l.surface),
      floor: l.floor,
      type: l.type,
      building: l.building,
      garden: "garden" in l ? new Prisma.Decimal(l.garden) : null,
      priceHT: new Prisma.Decimal(l.priceHT),
      vatRate: new Prisma.Decimal(l.vatRate),
      priceTTC: new Prisma.Decimal(
        Math.round(l.priceHT * (1 + l.vatRate / 100)),
      ),
      status: l.status,
    };
    await prisma.lot.upsert({
      where: {
        programmeId_reference: { programmeId: prog.id, reference: l.reference },
      },
      create: { programmeId: prog.id, reference: l.reference, ...data },
      update: data,
    });
  }
  await prisma.programme.update({
    where: { id: prog.id },
    data: { totalLots: lots.length },
  });
  console.log(`✓ "${prog.name}" + ${lots.length} lots`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
