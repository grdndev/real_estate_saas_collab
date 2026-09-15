"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DOSSIER_STATUS_BADGE } from "@/lib/dossier/labels";
import { LOT_STATUS_BADGE } from "@/lib/lot/labels";

interface Programme {
  id: string;
  name: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "Tous les statuts commerciaux" },
  ...Object.entries(DOSSIER_STATUS_BADGE).map(([value, b]) => ({
    value,
    label: b.label,
  })),
];

const LOT_STATUS_OPTIONS = [
  { value: "", label: "Tous les statuts contractuels" },
  ...Object.entries(LOT_STATUS_BADGE).map(([value, b]) => ({
    value,
    label: b.label,
  })),
];

export function LotFiltersForm({
  programmes,
  basePath,
}: {
  programmes: Programme[];
  /** Racine « lots » de l'espace appelant, ex. « /admin/lots ». */
  basePath: string;
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
    startTransition(() => {
      router.push(`${basePath}?${next.toString()}`);
    });
  }

  return (
    <form
      role="search"
      className="grid grid-cols-1 gap-3 sm:grid-cols-4"
      aria-busy={pending}
    >
      <Input
        type="search"
        defaultValue={params.get("search") ?? ""}
        placeholder="Rechercher (lot, client ou programme)…"
        onChange={(e) => update("search", e.target.value)}
        aria-label="Rechercher dans les lots"
      />
      <Select
        defaultValue={params.get("status") ?? ""}
        onChange={(e) => update("status", e.target.value)}
        aria-label="Filtrer par statut commercial"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
      <Select
        defaultValue={params.get("lotStatus") ?? ""}
        onChange={(e) => update("lotStatus", e.target.value)}
        aria-label="Filtrer par statut contractuel"
      >
        {LOT_STATUS_OPTIONS.map((opt) => (
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
