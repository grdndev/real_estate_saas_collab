import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { ClientCreateForm } from "./client-create-form";

export const metadata: Metadata = { title: "Créer un client" };

export default async function NewClientPage() {
  await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);

  const programmes = await prisma.programme.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      reference: true,
      lots: {
        where: { status: "AVAILABLE" },
        orderBy: { reference: "asc" },
        select: { id: true, reference: true, type: true },
      },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/collaborateur/dossiers"
          className="text-equatis-turquoise-700 text-sm hover:underline"
        >
          ← Retour aux dossiers
        </Link>
        <h1 className="text-equatis-night-800 mt-2 text-2xl font-semibold tracking-tight">
          Créer un client &amp; son dossier
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Crée le compte client + le dossier associé en un seul formulaire, et
          envoie un email d&apos;invitation pour que le client définisse son mot
          de passe.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent>
          {programmes.length === 0 ? (
            <p className="text-sm text-slate-600">
              Aucun programme actif. Demandez à l&apos;administrateur d&apos;en
              créer un.
            </p>
          ) : (
            <ClientCreateForm programmes={programmes} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
