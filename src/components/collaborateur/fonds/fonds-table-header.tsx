"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  upsertProgrammeAppelAction,
  deleteProgrammeAppelAction,
} from "@/lib/collaborateur/fonds-actions";
import { Badge } from "@/components/ui/badge";
import { Th, THead, Tr } from "@/components/ui/table";

export interface AppelHeader {
  numero: number;
  label: string;
  pourcentage: number;
  datePrevue: string; // ISO
  debloque: boolean;
}

interface Props {
  programmeId: string;
  appelHeaders: AppelHeader[];
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

function fmtPct(p: number): string {
  return p % 1 === 0 ? Math.floor(p).toString() : p.toFixed(1);
}

export function FondsTableHeader({ programmeId, appelHeaders }: Props) {
  const [modalState, setModalState] = useState<
    | { type: "closed" }
    | { type: "list" }
    | { type: "edit"; appel: AppelHeader }
    | { type: "add" }
  >({ type: "closed" });
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    label: "",
    pourcentage: "",
    datePrevue: "",
  });
  const router = useRouter();

  const debloques = appelHeaders.filter((h) => h.debloque);

  function openEdit(appel: AppelHeader) {
    setForm({
      label: appel.label,
      pourcentage: String(appel.pourcentage),
      datePrevue: appel.datePrevue.slice(0, 7),
    });
    setModalState({ type: "edit", appel });
  }

  function openAdd() {
    setForm({ label: "", pourcentage: "", datePrevue: "" });
    setModalState({ type: "add" });
  }

  return (
    <>
      <THead>
        <Tr className="border-b border-slate-200 bg-slate-50">
          <Th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-medium whitespace-nowrap text-slate-500">
            Lot
          </Th>
          <Th className="px-3 py-2 text-left font-medium whitespace-nowrap text-slate-500">
            Acquéreur
          </Th>
          <Th className="px-3 py-2 text-right font-medium whitespace-nowrap text-slate-500">
            Prix FAI
          </Th>
          <Th className="px-3 py-2 text-left font-medium whitespace-nowrap text-slate-500">
            Date signature
          </Th>
          <Th className="px-3 py-2 text-left font-medium whitespace-nowrap text-slate-500">
            Progression
          </Th>

          {debloques.map((h) => (
            <Th
              key={h.numero}
              onClick={() => openEdit(h)}
              className="cursor-pointer px-3 py-2 text-right font-medium whitespace-nowrap text-slate-500 select-none hover:bg-slate-100 hover:text-slate-800"
              title={`${h.label} — ${fmtMonth(h.datePrevue)} (cliquer pour modifier)`}
            >
              ({h.numero}) {fmtPct(h.pourcentage)}%
            </Th>
          ))}

          <Th
            onClick={() => setModalState({ type: "list" })}
            className="cursor-pointer px-3 py-2 text-center font-medium whitespace-nowrap text-slate-400 select-none hover:bg-slate-100 hover:text-slate-600"
            title="Gérer les appels de fonds (y compris à venir)"
          >
            Gérer
          </Th>

          <Th className="px-3 py-2 text-right font-medium whitespace-nowrap text-slate-500">
            COM
          </Th>
          <Th className="px-3 py-2 text-right font-medium whitespace-nowrap text-slate-500">
            Frais
          </Th>
          <Th className="px-3 py-2 text-right font-medium whitespace-nowrap text-slate-500">
            RBST EDD
          </Th>
          <Th className="px-3 py-2 text-right font-medium whitespace-nowrap text-slate-500">
            Solde vendeur
          </Th>
          <Th className="px-3 py-2 text-left font-medium whitespace-nowrap text-slate-500">
            Commentaire
          </Th>
        </Tr>
      </THead>

      {modalState.type !== "closed" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setModalState({ type: "closed" })}
        >
          <div
            className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {modalState.type === "list" ? (
              <>
                <h2 className="mb-4 text-base font-semibold text-slate-800">
                  Appels de fonds du programme
                </h2>
                {appelHeaders.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Aucun appel de fonds défini.
                  </p>
                ) : (
                  <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                    {appelHeaders.map((h) => (
                      <li key={h.numero}>
                        <button
                          onClick={() => openEdit(h)}
                          className="flex w-full items-center gap-3 px-2 py-2 text-left text-sm hover:bg-slate-50"
                        >
                          <span className="font-mono text-xs text-slate-500">
                            ({h.numero})
                          </span>
                          <span className="min-w-0 flex-1 truncate text-slate-700">
                            {h.label}
                          </span>
                          <span className="text-xs whitespace-nowrap text-slate-500">
                            {fmtMonth(h.datePrevue)} · {fmtPct(h.pourcentage)}%
                          </span>
                          {h.debloque ? (
                            <Badge variant="success">Débloqué</Badge>
                          ) : (
                            <Badge variant="neutral">À venir</Badge>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-5 flex justify-between gap-2">
                  <button
                    onClick={openAdd}
                    className="text-equatis-turquoise-700 text-sm hover:underline"
                  >
                    + Nouvel appel de fonds
                  </button>
                  <button
                    onClick={() => setModalState({ type: "closed" })}
                    className="text-sm text-slate-500 hover:underline"
                  >
                    Fermer
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="mb-4 text-base font-semibold text-slate-800">
                  {modalState.type === "edit"
                    ? `Appel (${modalState.appel.numero})`
                    : "Nouvel appel de fonds"}
                </h2>

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">
                      Label
                    </label>
                    <input
                      type="text"
                      value={form.label}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, label: e.target.value }))
                      }
                      className="focus:border-equatis-turquoise-400 w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">
                      Pourcentage (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.pourcentage}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, pourcentage: e.target.value }))
                      }
                      className="focus:border-equatis-turquoise-400 w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">
                      Date prévue (détermine le déblocage de l&apos;appel)
                    </label>
                    <input
                      type="month"
                      value={form.datePrevue}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, datePrevue: e.target.value }))
                      }
                      className="focus:border-equatis-turquoise-400 w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-5 flex justify-between gap-2">
                  {modalState.type === "edit" && (
                    <button
                      onClick={() => {
                        const numero = (
                          modalState as { type: "edit"; appel: AppelHeader }
                        ).appel.numero;
                        startTransition(async () => {
                          await deleteProgrammeAppelAction({
                            programmeId,
                            numero,
                          });
                          setModalState({ type: "closed" });
                          router.refresh();
                        });
                      }}
                      disabled={pending}
                      className="text-sm text-red-500 hover:underline disabled:opacity-40"
                    >
                      Supprimer
                    </button>
                  )}
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() => setModalState({ type: "list" })}
                      className="text-sm text-slate-500 hover:underline"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => {
                        const numero =
                          modalState.type === "edit"
                            ? modalState.appel.numero
                            : appelHeaders.length > 0
                              ? Math.max(...appelHeaders.map((h) => h.numero)) +
                                1
                              : 1;
                        startTransition(async () => {
                          await upsertProgrammeAppelAction({
                            programmeId,
                            numero,
                            label: form.label,
                            pourcentage: parseFloat(form.pourcentage) || 0,
                            datePrevue: form.datePrevue,
                          });
                          setModalState({ type: "closed" });
                          router.refresh();
                        });
                      }}
                      disabled={
                        pending || !form.label.trim() || !form.datePrevue
                      }
                      className="bg-equatis-night-800 rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                    >
                      {pending ? "…" : "Enregistrer"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
