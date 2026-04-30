import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { DossierCreateForm } from "./dossier-create-form";

export const metadata: Metadata = { title: "Nouveau dossier" };

export default async function NewDossierPage() {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);

  const [programmes, collaborators, pendingClients] = await Promise.all([
    prisma.programme.findMany({
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
    }),
    prisma.user.findMany({
      where: {
        role: "COLLABORATOR",
        status: "ACTIVE",
        deletedAt: null,
      },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    prisma.user.findMany({
      where: {
        role: "CLIENT",
        status: "PENDING_ASSOCIATION",
        deletedAt: null,
        clientDossier: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
  ]);

  // Pour le SUPER_ADMIN qui n'est pas un collaborateur, on le rajoute en option
  // si la liste est vide.
  const defaultCollaboratorId =
    collaborators.find((c) => c.id === me.id)?.id ?? collaborators[0]?.id ?? "";

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
          Nouveau dossier
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Créez un dossier vide ou associez immédiatement un client inscrit.
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
          ) : collaborators.length === 0 ? (
            <p className="text-sm text-slate-600">
              Aucun collaborateur actif. Demandez à l&apos;administrateur
              d&apos;en inviter un.
            </p>
          ) : (
            <DossierCreateForm
              programmes={programmes}
              collaborators={collaborators}
              pendingClients={pendingClients}
              defaultCollaboratorId={defaultCollaboratorId}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
