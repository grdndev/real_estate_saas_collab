"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  assignPromoterAction,
  unassignPromoterAction,
} from "@/lib/admin/actions";

interface PromoterOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Props {
  programmeId: string;
  assigned: PromoterOption[];
  available: PromoterOption[];
}

export function PromoterAssignment({
  programmeId,
  assigned,
  available,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState("");

  function add() {
    if (!selected) return;
    startTransition(async () => {
      await assignPromoterAction({ programmeId, promoterId: selected });
      setSelected("");
      router.refresh();
    });
  }

  function remove(promoterId: string) {
    startTransition(async () => {
      await unassignPromoterAction({ programmeId, promoterId });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {assigned.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun promoteur assigné.</p>
        ) : (
          assigned.map((p) => (
            <Badge key={p.id} variant="accent" className="gap-2">
              {p.firstName} {p.lastName}
              <button
                type="button"
                aria-label={`Retirer ${p.firstName} ${p.lastName}`}
                onClick={() => remove(p.id)}
                disabled={pending}
                className="hover:text-equatis-night-900"
              >
                <X className="size-3" aria-hidden />
              </button>
            </Badge>
          ))
        )}
      </div>
      {available.length > 0 ? (
        <div className="flex gap-2">
          <Select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="max-w-sm"
          >
            <option value="">Sélectionner un promoteur…</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName} ({p.email})
              </option>
            ))}
          </Select>
          <Button onClick={add} disabled={!selected || pending}>
            Assigner
          </Button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Tous les promoteurs disponibles sont déjà assignés.
        </p>
      )}
    </div>
  );
}
