"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  upsertProgrammeAppelAction,
  deleteProgrammeAppelAction,
} from "@/lib/collaborateur/fonds-actions";
import { Badge } from "@/components/ui/badge";

export interface AppelHeader {
  id: string;
  numero: number;
  label: string;
  pourcentage: number;
  datePrevue: string; // ISO
  debloque: boolean;
}

export type AppelsModalInitialState =
  | { type: "list" }
  | { type: "edit"; appel: AppelHeader };

interface Props {
  programmeId: string;
  appelHeaders: AppelHeader[];
  initialState: AppelsModalInitialState;
  onClose: () => void;
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

export function AppelsFondsModal({
  programmeId,
  appelHeaders,
  initialState,
  onClose,
}: Props) {
  const [modalState, setModalState] = useState<
    { type: "list" } | { type: "edit"; appel: AppelHeader } | { type: "add" }
  >(initialState);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() =>
    initialState.type === "edit"
      ? {
          label: initialState.appel.label,
          pourcentage: String(initialState.appel.pourcentage),
          datePrevue: initialState.appel.datePrevue.slice(0, 7),
        }
      : { label: "", pourcentage: "", datePrevue: "" },
  );
  const router = useRouter();

  function openEdit(appel: AppelHeader) {
    setForm({
      label: appel.label,
      pourcentage: String(appel.pourcentage),
      datePrevue: appel.datePrevue.slice(0, 7),
    });
    setError(null);
    setModalState({ type: "edit", appel });
  }

  function openAdd() {
    setForm({ label: "", pourcentage: "", datePrevue: "" });
    setError(null);
    setModalState({ type: "add" });
  }

  const pourcentageNum = parseFloat(form.pourcentage.replace(",", "."));
  const pourcentageValide =
    isFinite(pourcentageNum) && pourcentageNum >= 0 && pourcentageNum <= 100;

  function handleSave() {
    const numero = modalState.type === "edit" ? modalState.appel.numero : null;
    setError(null);
    startTransition(async () => {
      const res = await upsertProgrammeAppelAction({
        programmeId,
        numero,
        label: form.label,
        pourcentage: pourcentageNum,
        datePrevue: form.datePrevue,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  function handleDelete(numero: number) {
    setError(null);
    startTransition(async () => {
      const res = await deleteProgrammeAppelAction({ programmeId, numero });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
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
                onClick={onClose}
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

            {error && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-between gap-2">
              {modalState.type === "edit" && (
                <button
                  onClick={() => handleDelete(modalState.appel.numero)}
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
                  onClick={handleSave}
                  disabled={
                    pending ||
                    !form.label.trim() ||
                    !form.datePrevue ||
                    !pourcentageValide
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
  );
}
