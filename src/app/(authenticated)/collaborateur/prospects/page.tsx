import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProspectCreateForm } from "@/components/prospects/prospect-create-form";
import { ProspectImportForm } from "@/components/prospects/prospect-import-form";
import {
  ProspectsTable,
  type ProspectRow,
} from "@/components/prospects/prospects-table";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { dossierHasActivity } from "@/lib/prospect/dossier-activity";

export const metadata: Metadata = { title: "Prospects" };

export default async function CollabProspectsPage() {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);

  const [prospects, programmes] = await Promise.all([
    prisma.prospect.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        programme: { select: { name: true } },
        convertedDossier: {
          select: {
            id: true,
            timelineEvents: { select: { kind: true } },
            _count: {
              select: {
                documents: true,
                signatures: true,
                messages: true,
                invoices: true,
              },
            },
          },
        },
        sharedNotes: {
          orderBy: { createdAt: "desc" },
          include: {
            author: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.programme.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        lots: {
          where: { status: "AVAILABLE" },
          orderBy: { reference: "asc" },
          select: { id: true, reference: true, type: true },
        },
      },
    }),
  ]);

  const rows: ProspectRow[] = prospects.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    city: p.city,
    phone: p.phone,
    programmeId: p.programmeId,
    programmeName: p.programme?.name ?? null,
    source: p.source,
    status: p.status,
    convertedDossierId: p.convertedDossier?.id ?? null,
    dossierHasActivity: dossierHasActivity(p.convertedDossier),
    createdAt: p.createdAt,
    notes: p.sharedNotes.map((n) => ({
      id: n.id,
      body: n.body,
      authorId: n.authorId,
      authorName: `${n.author.firstName} ${n.author.lastName}`,
      createdAt: n.createdAt.toISOString(),
    })),
  }));

  // Les prospects réservataires et qualifiés sont isolés dans leur propre section.
  const optioned = rows.filter((p) => p.status === "OPTIONED");
  const qualified = rows.filter((p) => p.status === "QUALIFIED");
  const others = rows.filter(
    (p) => p.status !== "QUALIFIED" && p.status !== "OPTIONED",
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Prospects
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Gérez les leads entrants et importez vos contacts Google Forms.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Importer depuis Google Forms (CSV)</CardTitle>
        </CardHeader>
        <CardContent>
          <ProspectImportForm programmes={programmes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ajouter un prospect</CardTitle>
        </CardHeader>
        <CardContent>
          <ProspectCreateForm programmes={programmes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prospects réservataires ({optioned.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-slate-600">
            Prospects ayant réservé, prêts à être convertis en client.
          </p>
          <ProspectsTable
            prospects={optioned}
            programmes={programmes}
            canDelete
            currentUserId={me.id}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prospects qualifiés ({qualified.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-slate-600">
            Prospects passés au statut « Qualifié ». Ils basculent
            automatiquement ici dès qu&apos;une collaboratrice les qualifie.
          </p>
          <ProspectsTable
            prospects={qualified}
            programmes={programmes}
            canDelete
            currentUserId={me.id}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liste des prospects ({others.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ProspectsTable
            prospects={others}
            programmes={programmes}
            canDelete
            currentUserId={me.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
