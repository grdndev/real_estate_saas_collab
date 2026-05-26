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
import { programmesForPromoter } from "@/lib/promoter/access";

export const metadata: Metadata = { title: "Prospects" };

export default async function PromoteurProspectsPage() {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);

  const programmeIds =
    me.role === "PROMOTER" ? await programmesForPromoter(me.id) : null;

  const where =
    programmeIds !== null ? { programmeId: { in: programmeIds } } : {};

  const [prospects, programmes] = await Promise.all([
    prisma.prospect.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        programme: { select: { name: true } },
        sharedNotes: {
          orderBy: { createdAt: "desc" },
          include: {
            author: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    }),
    me.role === "PROMOTER"
      ? prisma.programme.findMany({
          where: { id: { in: programmeIds ?? [] } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, reference: true },
        })
      : prisma.programme.findMany({
          where: { status: "ACTIVE" },
          orderBy: { name: "asc" },
          select: { id: true, name: true, reference: true },
        }),
  ]);

  const rows: ProspectRow[] = prospects.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    city: p.city,
    phone: p.phone,
    programmeName: p.programme?.name ?? null,
    source: p.source,
    status: p.status,
    createdAt: p.createdAt,
    notes: p.sharedNotes.map((n) => ({
      id: n.id,
      body: n.body,
      authorId: n.authorId,
      authorName: `${n.author.firstName} ${n.author.lastName}`,
      createdAt: n.createdAt.toISOString(),
    })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Prospects
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Leads de vos programmes — visibilité limitée aux programmes auxquels
          vous êtes assigné.
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
          <CardTitle>Liste des prospects ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ProspectsTable prospects={rows} canDelete currentUserId={me.id} />
        </CardContent>
      </Card>
    </div>
  );
}
