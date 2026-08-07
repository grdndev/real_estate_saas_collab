import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadLotDossierHistory } from "@/lib/lot/access";
import { displayableEmail } from "@/lib/user/no-account";

/**
 * Historique des clients d'un lot : dossiers archivés à la dissociation.
 *
 * Ils gardent leurs messages, documents et timeline ; réassocier le même client
 * à ce lot réactive son dossier tel quel.
 */
export async function LotDossierHistoryCard({ lotId }: { lotId: string }) {
  const dossiers = await loadLotDossierHistory(lotId);
  if (dossiers.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique du lot ({dossiers.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-slate-500">
          Anciens clients de ce lot. Réassocier l&apos;un d&apos;eux restitue
          son dossier complet (messages, documents, timeline).
        </p>
        <ul className="divide-y divide-slate-100">
          {dossiers.map((d) => (
            <li key={d.id} className="flex justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {d.client.firstName} {d.client.lastName}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {displayableEmail(d.client.email) ?? "—"}
                </p>
              </div>
              <div className="shrink-0 text-right text-xs text-slate-500">
                <p>
                  Dissocié le {d.archivedAt?.toLocaleDateString("fr-FR") ?? "—"}
                </p>
                <p>
                  {d._count.messages} message
                  {d._count.messages > 1 ? "s" : ""} · {d._count.documents}{" "}
                  document{d._count.documents > 1 ? "s" : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
