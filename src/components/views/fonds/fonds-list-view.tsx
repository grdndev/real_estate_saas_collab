import { FondsImportButtonLazy } from "@/components/collaborateur/fonds-import/fonds-import-button-lazy";
import { ProgrammeSelect } from "@/components/collaborateur/fonds/programme-select";
import { ClickableRow } from "@/components/collaborateur/fonds/clickable-row";
import { FondsTableHeader } from "@/components/collaborateur/fonds/fonds-table-header";
import { GererAppelsButton } from "@/components/collaborateur/fonds/gerer-appels-button";
import { Table, TBody, Td } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import type { FondsOverview } from "@/lib/fonds/access";
import { sortByLotReference, type LotSortDirection } from "@/lib/lot/sort";
import { cn } from "@/lib/utils";

/**
 * Vue « suivi des fonds » — implémentation unique partagée par les espaces
 * admin et collaborateur (T15). La vue ne connaît pas le rôle : le périmètre
 * des données est résolu par la route via `loadFondsOverview`, et les liens
 * sont construits à partir de `basePath`.
 */
interface Props {
  data: FondsOverview;
  /** Préfixe des liens de l'espace appelant, ex. « /admin/fonds ». */
  basePath: string;
  /** Sens du tri naturel sur la référence de lot (T13). */
  sortDirection: LotSortDirection;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null || n === 0) return "0";
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function fmtMonth(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function lrPastille(
  dateEnvoiLr: Date | null,
  dateReceptionVirement: Date | null,
): { className: string; title: string } {
  if (dateEnvoiLr == null) {
    return { className: "bg-red-400", title: "LR non envoyée" };
  }
  if (dateReceptionVirement == null) {
    return {
      className: "bg-yellow-300",
      title: "LR envoyée, virement en attente",
    };
  }
  return { className: "bg-emerald-500", title: "Payé" };
}

export function FondsListView({ data, basePath, sortDirection }: Props) {
  const {
    programmes,
    programme,
    lots,
    appelHeaders,
    selectedId,
    programmeOptions,
  } = data;

  // Tri naturel des références de lot (T13) : « Lot 2 » avant « Lot 10 ».
  const sortedLots = sortByLotReference(
    lots,
    (l) => l.reference,
    sortDirection,
  );

  const appelsDebloques = appelHeaders.filter((h) => h.debloque);
  const debloqueIds = new Set(appelsDebloques.map((h) => h.id));
  const prochainAppel = appelHeaders.find((h) => !h.debloque) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
            Suivi des fonds
          </h1>
          {programme && (
            <p className="mt-1 text-sm text-slate-500">{programme.name}</p>
          )}
          {programme && (
            <div className="mt-2">
              <GererAppelsButton
                programmeId={programme.id}
                appelHeaders={appelHeaders}
              />
            </div>
          )}
          {programme && appelHeaders.length > 0 && (
            <p className="mt-1 text-sm text-slate-500">
              Avancement : {appelsDebloques.length}/{appelHeaders.length} appel
              {appelsDebloques.length > 1 ? "s" : ""} débloqué
              {appelsDebloques.length > 1 ? "s" : ""}
              {prochainAppel && (
                <>
                  {" "}
                  — prochain : ({prochainAppel.numero}){" "}
                  {fmtMonth(prochainAppel.datePrevue)}
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <FondsImportButtonLazy programmes={programmeOptions} />
        </div>
      </div>

      {programmes.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Programme :</span>
          <ProgrammeSelect
            programmes={programmeOptions}
            selectedId={selectedId}
            basePath={basePath}
          />
        </div>
      )}

      {!programme ? (
        <p className="text-sm text-slate-500">Aucun programme actif.</p>
      ) : lots.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun lot dans ce programme.</p>
      ) : (
        <Card>
          <Table className="min-w-max">
            <FondsTableHeader
              programmeId={programme.id}
              appelHeaders={appelHeaders}
              sortDirection={sortDirection}
              programmeParam={selectedId}
            />
            <TBody>
              {sortedLots.map((lot) => {
                const fs = lot.fondsSuivi;
                const actSignedDate =
                  lot.dossier?.timelineEvents?.[0]?.occurredAt ?? null;
                const clientName = lot.dossier?.client
                  ? `${lot.dossier.client.firstName} ${lot.dossier.client.lastName}`.trim()
                  : null;

                return (
                  <ClickableRow key={lot.id} href={`${basePath}/${lot.id}`}>
                    <Td className="bg-equatis-surface sticky left-0 z-5 px-4 py-3 font-mono font-medium whitespace-nowrap">
                      {lot.reference}
                    </Td>
                    <Td className="px-4 py-3 whitespace-nowrap text-slate-700">
                      {clientName ?? <span className="text-slate-400">—</span>}
                    </Td>
                    <Td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      {fmtMoney(Number(lot.priceTTC))}
                    </Td>
                    <Td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {actSignedDate ? (
                        fmtDate(actSignedDate)
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </Td>
                    <Td className="px-4 py-3 whitespace-nowrap">
                      {fs && appelHeaders.length > 0 ? (
                        (() => {
                          // Montant réellement encaissé sur les appels débloqués.
                          const montantAppele = fs.fondsAppeles
                            .filter(
                              (fa) =>
                                debloqueIds.has(fa.appelFondsId) &&
                                fa.dateReceptionVirement != null,
                            )
                            .reduce((s, fa) => s + Number(fa.montant), 0);
                          const montantTotal = fs.fondsAppeles.reduce(
                            (s, fa) => s + Number(fa.montant),
                            0,
                          );
                          return (
                            <div className="flex flex-col gap-0.5 text-slate-600">
                              <span>
                                {appelsDebloques.length}/{appelHeaders.length}{" "}
                                appel{appelsDebloques.length > 1 ? "s" : ""}
                              </span>
                              <span className="tabular-nums">
                                {fmtMoney(montantAppele)} /{" "}
                                {fmtMoney(montantTotal)} €
                              </span>
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </Td>

                    {appelsDebloques.map((h) => {
                      const appel = fs?.fondsAppeles.find(
                        (fa) => fa.appelFondsId === h.id,
                      );
                      const pastille = appel
                        ? lrPastille(
                            appel.dateEnvoiLr,
                            appel.dateReceptionVirement,
                          )
                        : null;
                      return (
                        <Td
                          key={h.numero}
                          className="px-4 py-3 text-right whitespace-nowrap tabular-nums"
                        >
                          {appel != null && pastille != null ? (
                            <span className="inline-flex items-center justify-end gap-1.5">
                              {fmtMoney(Number(appel.montant))}
                              <span
                                className={cn(
                                  "size-2 shrink-0 rounded-full",
                                  pastille.className,
                                )}
                                title={pastille.title}
                              />
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </Td>
                      );
                    })}
                    {appelHeaders.length === 0 && <Td className="p-0" />}
                    <Td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      {fs?.commission != null ? (
                        fmtMoney(Number(fs.commission))
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </Td>
                    <Td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      {fs?.fraisMainLevee != null ? (
                        fmtMoney(Number(fs.fraisMainLevee))
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </Td>
                    <Td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      {fs?.rbstEdd != null ? (
                        fmtMoney(Number(fs.rbstEdd))
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </Td>
                    <Td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      {fs?.soldeVendeur != null ? (
                        fmtMoney(Number(fs.soldeVendeur))
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </Td>
                    <Td className="max-w-50 px-4 py-3 text-slate-600">
                      {lot.notes ? (
                        <span className="line-clamp-2">{lot.notes}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </Td>
                  </ClickableRow>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
