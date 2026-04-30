"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface Programme {
  id: string;
  reference: string;
  name: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "Tous les statuts" },
  { value: "NEW_LEAD", label: "Nouveau lead" },
  { value: "RESERVATION_SENT", label: "Réservation envoyée" },
  { value: "SIGNATURE_PENDING", label: "Signature en attente" },
  { value: "SIGNED_AT_NOTARY", label: "Chez le notaire" },
  { value: "LOAN_OFFER_RECEIVED", label: "Offre de prêt reçue" },
  { value: "ACT_SIGNED", label: "Acte signé" },
  { value: "BLOCKED", label: "Bloqué" },
];

export function DossierFiltersForm({
  programmes,
}: {
  programmes: Programme[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete("page");
    startTransition(() => {
      router.push(`/collaborateur/dossiers?${next.toString()}`);
    });
  }

  return (
    <form
      role="search"
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      aria-busy={pending}
    >
      <Input
        type="search"
        defaultValue={params.get("search") ?? ""}
        placeholder="Rechercher (référence ou programme)…"
        onChange={(e) => update("search", e.target.value)}
        aria-label="Rechercher dans les dossiers"
      />
      <Select
        defaultValue={params.get("status") ?? ""}
        onChange={(e) => update("status", e.target.value)}
        aria-label="Filtrer par statut"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
      <Select
        defaultValue={params.get("programmeId") ?? ""}
        onChange={(e) => update("programmeId", e.target.value)}
        aria-label="Filtrer par programme"
      >
        <option value="">Tous les programmes</option>
        {programmes.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
    </form>
  );
}
