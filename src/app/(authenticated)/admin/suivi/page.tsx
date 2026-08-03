import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Suivi de programme · Admin" };

/**
 * Point d'entrée du suivi de programme côté admin : redirige vers le premier
 * programme actif. Le choix du programme se fait ensuite via la barre latérale.
 */
export default async function AdminSuiviIndexPage() {
  await requireRole("SUPER_ADMIN");

  const first = await prisma.programme.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true },
  });

  if (first) redirect(`/admin/suivi/${first.id}`);

  return (
    <Card>
      <EmptyState
        title="Aucun programme actif"
        description="Créez un programme depuis la section Programmes pour accéder à son suivi."
      />
    </Card>
  );
}
