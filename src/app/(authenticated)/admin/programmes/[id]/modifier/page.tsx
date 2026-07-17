import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { ProgrammeForm } from "../../nouveau/programme-form";

export const metadata: Metadata = { title: "Modifier le programme" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProgrammePage({ params }: PageProps) {
  await requireRole("SUPER_ADMIN");
  const { id } = await params;

  const programme = await prisma.programme.findUnique({ where: { id } });
  if (!programme) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/admin/programmes/${programme.id}`}
          className="text-equatis-turquoise-700 text-sm hover:underline"
        >
          ← Retour au programme
        </Link>
        <h1 className="text-equatis-night-800 mt-2 text-2xl font-semibold tracking-tight">
          Modifier « {programme.name} »
        </h1>
      </div>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgrammeForm
            programme={{
              id: programme.id,
              name: programme.name,
              description: programme.description,
              zipcode: programme.zipcode,
              city: programme.city,
              address: programme.address,
              caObjective:
                programme.caObjective != null
                  ? Number(programme.caObjective)
                  : null,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
