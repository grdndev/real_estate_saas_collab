"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  upsertProgrammeAppelAction,
  deleteProgrammeAppelAction,
} from "@/lib/collaborateur/fonds-actions";

interface AppelHeader {
  numero: number;
  label: string;
  pourcentage: number;
  datePrevue: string | null;
}

interface Props {
  programmeId: string;
  appelHeaders: AppelHeader[];
}

export function FondsTableHeader({ programmeId, appelHeaders }: Props) {
  const [modalState, setModalState] = useState<
    { type: "closed" } | { type: "edit"; appel: AppelHeader } | { type: "add" }
  >({ type: "closed" });
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    label: "",
    pourcentage: "",
    datePrevue: "",
  });
  const router = useRouter();

  return (
    <>
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50">
          <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-medium whitespace-nowrap text-slate-500">
            Lot
          </th>
          <th className="px-3 py-2 text-left font-medium whitespace-nowrap text-slate-500">
            Acquéreur
          </th>
          <th className="px-3 py-2 text-right font-medium whitespace-nowrap text-slate-500">
            Prix FAI
          </th>
          <th className="px-3 py-2 text-left font-medium whitespace-nowrap text-slate-500">
            Date signature
          </th>

          {appelHeaders.map((h) => (
            <th
              key={h.numero}
              onClick={() => {
                setForm({
                  label: h.label,
                  pourcentage: String(h.pourcentage),
                  datePrevue: h.datePrevue ?? "",
                });
                setModalState({ type: "edit", appel: h });
              }}
              className="cursor-pointer px-3 py-2 text-right font-medium whitespace-nowrap text-slate-500 select-none hover:bg-slate-100 hover:text-slate-800"
              title="Cliquer pour modifier cet appel"
            >
              ({h.numero}){" "}
              {h.pourcentage % 1 === 0
                ? Math.floor(h.pourcentage).toString()
                : h.pourcentage.toFixed(1)}
              %
            </th>
          ))}

          <th
            onClick={() => {
              setForm({ label: "", pourcentage: "", datePrevue: "" });
              setModalState({ type: "add" });
            }}
            className="cursor-pointer px-3 py-2 text-center font-medium whitespace-nowrap text-slate-400 select-none hover:bg-slate-100 hover:text-slate-600"
            title="Ajouter un appel de fonds"
          >
            +
          </th>

          <th className="px-3 py-2 text-right font-medium whitespace-nowrap text-slate-500">
            COM
          </th>
          <th className="px-3 py-2 text-right font-medium whitespace-nowrap text-slate-500">
            Frais
          </th>
          <th className="px-3 py-2 text-right font-medium whitespace-nowrap text-slate-500">
            RBST EDD
          </th>
          <th className="px-3 py-2 text-right font-medium whitespace-nowrap text-slate-500">
            Solde vendeur
          </th>
          <th className="px-3 py-2 text-left font-medium whitespace-nowrap text-slate-500">
            Suivi LR
          </th>
          <th className="px-3 py-2 text-left font-medium whitespace-nowrap text-slate-500">
            Commentaire
          </th>
        </tr>
      </thead>

      {modalState.type !== "closed" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setModalState({ type: "closed" })}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
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
                  Date prévue (ex: Janvier 2027)
                </label>
                <input
                  type="text"
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
                      await deleteProgrammeAppelAction({ programmeId, numero });
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
                  onClick={() => setModalState({ type: "closed" })}
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
                          ? Math.max(...appelHeaders.map((h) => h.numero)) + 1
                          : 1;
                    startTransition(async () => {
                      await upsertProgrammeAppelAction({
                        programmeId,
                        numero,
                        label: form.label,
                        pourcentage: parseFloat(form.pourcentage) || 0,
                        datePrevue: form.datePrevue || null,
                      });
                      setModalState({ type: "closed" });
                      router.refresh();
                    });
                  }}
                  disabled={pending || !form.label.trim()}
                  className="bg-equatis-night-800 rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  {pending ? "…" : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
