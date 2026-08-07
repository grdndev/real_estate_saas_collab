import type { Metadata } from "next";

import { NewLotView } from "@/components/views/lots/new-lot-view";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Nouveau lot" };

export default async function NewLotPage() {
  await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);

  const programmes = await prisma.programme.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return <NewLotView programmes={programmes} basePath="/collaborateur/lots" />;
}
