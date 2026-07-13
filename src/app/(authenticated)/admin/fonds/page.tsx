import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { FondsImportButtonLazy } from "@/components/collaborateur/fonds-import/fonds-import-button-lazy";
import { ProgrammeSelect } from "@/components/collaborateur/fonds/programme-select";
import { ClickableRow } from "@/components/collaborateur/fonds/clickable-row";
import { FondsTableHeader } from "@/components/collaborateur/fonds/fonds-table-header";
import { Table, TBody, Td } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Suivi des fonds · Admin" };

interface PageProps {
  searchParams: Promise<{ programme?: string }>;
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
  if (n == null || n === 0) return "—";
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default async function AdminFondsPage({ searchParams }: PageProps) {
  await requireRole("SUPER_ADMIN");
  const params = await searchParams;

  const programmes = await prisma.programme.findMany({
    where: { status: "ACTIVE" },
    include: {
      lots: {
        include: {
          fondsSuivi: {
            include: { appelsFonds: { orderBy: { numero: "asc" } } },
          },
          dossier: {
            include: {
              client: { select: { firstName: true, lastName: true } },
              timelineEvents: {
                where: { kind: "ACT_SIGNED" },
                orderBy: { occurredAt: "desc" },
                take: 1,
                select: { occurredAt: true },
              },
            },
          },
        },
        orderBy: { reference: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const selectedId = params.programme ?? programmes[0]?.id ?? null;
  const programme = programmes.find((p) => p.id === selectedId) ?? null;
  const lots = programme?.lots ?? [];

  const appelHeaders = programme
    ? (
        await prisma.appelFonds.findMany({
          where: { lotFonds: { programmeId: programme.id } },
          orderBy: { numero: "asc" },
          distinct: ["numero"],
          select: {
            numero: true,
            label: true,
            pourcentage: true,
            datePrevue: true,
          },
        })
      ).map((a) => ({
        numero: a.numero,
        label: a.label,
        pourcentage: Number(a.pourcentage),
        datePrevue: a.datePrevue ?? null,
      }))
    : [];

  const importProgrammes = programmes.map((p) => ({
    id: p.id,
    name: p.name,
    reference: p.reference,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
            Suivi des fonds
          </h1>
          {programme && (
            <p className="mt-1 text-sm text-slate-500">
              {programme.name} — {programme.reference}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <FondsImportButtonLazy programmes={importProgrammes} />
        </div>
      </div>

      {programmes.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Programme :</span>
          <ProgrammeSelect
            programmes={importProgrammes}
            selectedId={selectedId}
            basePath="/admin/fonds"
          />
        </div>
      )}

      {!programme ? (
        <p className="text-sm text-slate-500">Aucun programme actif.</p>
      ) : lots.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun lot dans ce programme.</p>
      ) : (
        <div className="rounded-lg border border-slate-200">
          <Table className="min-w-max border-collapse text-xs">
            <FondsTableHeader
              programmeId={programme.id}
              appelHeaders={appelHeaders}
            />
            <TBody>
              {lots.map((lot) => {
                const fs = lot.fondsSuivi;
                const isEmpty = !fs;
                const actSignedDate =
                  lot.dossier?.timelineEvents?.[0]?.occurredAt ?? null;
                const clientName = lot.dossier?.client
                  ? `${lot.dossier.client.firstName} ${lot.dossier.client.lastName}`.trim()
                  : null;

                const rowClass = cn(
                  isEmpty ? "bg-slate-50/60" : "hover:bg-slate-50",
                );

                return (
                  <ClickableRow
                    key={lot.id}
                    href={`/admin/fonds/${lot.id}`}
                    className={rowClass}
                  >
                    <Td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-mono font-medium whitespace-nowrap">
                      {lot.reference}
                    </Td>
                    <Td className="px-3 py-2 whitespace-nowrap text-slate-700">
                      {clientName ?? <span className="text-slate-400">—</span>}
                    </Td>
                    <Td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                      {fmtMoney(Number(lot.priceTTC))}
                    </Td>
                    <Td className="px-3 py-2 whitespace-nowrap text-slate-600">
                      {actSignedDate ? (
                        fmtDate(actSignedDate)
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </Td>
                    {appelHeaders.map((h) => {
                      const appel = fs?.appelsFonds.find(
                        (a) => a.numero === h.numero,
                      );
                      return (
                        <Td
                          key={h.numero}
                          className="px-3 py-2 text-right whitespace-nowrap tabular-nums"
                        >
                          {appel != null ? (
                            fmtMoney(Number(appel.montant))
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </Td>
                      );
                    })}
                    {/* Align with + button */}
                    <Td className="p-0" />
                    <Td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                      {fs?.commission != null ? (
                        fmtMoney(Number(fs.commission))
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </Td>
                    <Td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                      {fs?.fraisMainLevee != null ? (
                        fmtMoney(Number(fs.fraisMainLevee))
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </Td>
                    <Td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                      {fs?.rbstEdd != null ? (
                        fmtMoney(Number(fs.rbstEdd))
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </Td>
                    <Td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                      {fs?.soldeVendeur != null ? (
                        fmtMoney(Number(fs.soldeVendeur))
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </Td>
                    <Td className="px-3 py-2 whitespace-nowrap">
                      {fs ? (
                        <div className="flex flex-col gap-0.5 text-slate-600">
                          <span>
                            <span className="text-slate-400">Env: </span>
                            {fmtDate(fs.dateEnvoiLr)}
                          </span>
                          <span>
                            <span className="text-slate-400">Réc: </span>
                            {fmtDate(fs.dateReceptionLr)}
                          </span>
                          <span>
                            <span className="text-slate-400">Vir: </span>
                            {fmtDate(fs.dateReceptionVirement)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </Td>
                    <Td className="max-w-50 px-3 py-2 text-slate-600">
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
        </div>
      )}
    </div>
  );
}
