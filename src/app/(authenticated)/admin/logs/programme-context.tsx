import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { getProgrammeContext } from "@/lib/admin/activity";

type ProgrammeContext = NonNullable<
  Awaited<ReturnType<typeof getProgrammeContext>>
>;

const PROGRAMME_STATUS_BADGE = {
  DRAFT: { label: "Brouillon", variant: "neutral" as const },
  ACTIVE: { label: "Actif", variant: "success" as const },
  ARCHIVED: { label: "Archivé", variant: "warning" as const },
};

const LOT_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "disponible(s)",
  OPTIONED: "optionné(s)",
  RESERVED: "réservé(s)",
  SOLD: "vendu(s)",
  WITHDRAWN: "retiré(s)",
};

const DOSSIER_STATUS_LABEL: Record<string, string> = {
  NEW_LEAD: "nouveau lead",
  RESERVATION_SENT: "réservation envoyée",
  SIGNATURE_PENDING: "signature en attente",
  SIGNED_AT_NOTARY: "chez le notaire",
  LOAN_OFFER_RECEIVED: "offre de prêt reçue",
  ACT_SIGNED: "acte signé",
  BLOCKED: "bloqué",
};

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs tracking-wider text-slate-500 uppercase">
        {label}
      </dt>
      <dd className="text-equatis-night-800 mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

export function ProgrammeContextPanel({
  programme,
}: {
  programme: ProgrammeContext;
}) {
  const statusBadge = PROGRAMME_STATUS_BADGE[programme.status];
  const soldLots = programme.lotCounts.get("SOLD") ?? 0;
  const signedDossiers = programme.dossierCounts.get("ACT_SIGNED") ?? 0;
  // Dossiers actifs du programme = lots portant un client.
  const activeDossiers = [...programme.dossierCounts.values()].reduce(
    (acc, n) => acc + n,
    0,
  );

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between">
        <CardTitle>Programme {programme.name}</CardTitle>
        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Ville">{programme.city || "—"}</Fact>
          <Fact label="Promoteurs">
            {programme.promoters.length === 0
              ? "—"
              : programme.promoters
                  .map((p) => `${p.promoter.firstName} ${p.promoter.lastName}`)
                  .join(", ")}
          </Fact>
          <Fact label="Créé le">
            {programme.createdAt.toLocaleDateString("fr-FR")}
          </Fact>
          <Fact label="Archivé le">
            {programme.archivedAt
              ? programme.archivedAt.toLocaleDateString("fr-FR")
              : "—"}
          </Fact>
          <Fact label="Lots">
            {programme.lots.length} lot{programme.lots.length > 1 ? "s" : ""}
            {soldLots > 0 &&
              ` dont ${soldLots} vendu${soldLots > 1 ? "s" : ""}`}
            {programme.lots.length > 0 && (
              <span className="mt-1 flex flex-wrap gap-1.5">
                {[...programme.lotCounts.entries()].map(([status, count]) => (
                  <Badge key={status} variant="neutral">
                    {count} {LOT_STATUS_LABEL[status] ?? status}
                  </Badge>
                ))}
              </span>
            )}
          </Fact>
          <Fact label="Dossiers">
            {activeDossiers} dossier{activeDossiers > 1 ? "s" : ""}
            {signedDossiers > 0 &&
              ` dont ${signedDossiers} acté${signedDossiers > 1 ? "s" : ""}`}
            {activeDossiers > 0 && (
              <span className="mt-1 flex flex-wrap gap-1.5">
                {[...programme.dossierCounts.entries()].map(
                  ([status, count]) => (
                    <Badge key={status} variant="neutral">
                      {count} {DOSSIER_STATUS_LABEL[status] ?? status}
                    </Badge>
                  ),
                )}
              </span>
            )}
          </Fact>
          <Fact label="Fiche programme">
            <Link
              href={`/admin/programmes/${programme.id}`}
              className="text-equatis-turquoise-700 hover:underline"
            >
              Ouvrir dans la gestion des programmes
            </Link>
          </Fact>
        </dl>
      </CardContent>
    </Card>
  );
}
