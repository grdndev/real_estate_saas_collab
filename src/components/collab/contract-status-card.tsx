"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { updateContractStatusAction } from "@/lib/dossier/actions";
import type { ContractStatus } from "@/generated/prisma/enums";
import {
  CONTRACT_STATUS_BADGE,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_ORDER,
} from "@/lib/dossier/labels";

interface Props {
  dossierId: string;
  current: ContractStatus | null;
}

export function ContractStatusCard({ dossierId, current }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [next, setNext] = useState<ContractStatus>(
    current ?? "AWAITING_SIGNATURE",
  );
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await updateContractStatusAction({
        dossierId,
        contractStatus: next,
        comment: comment || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setComment("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-xs text-slate-500">Statut contractuel actuel</p>
        <p className="mt-1">
          {current ? (
            <Badge variant={CONTRACT_STATUS_BADGE[current]}>
              {CONTRACT_STATUS_LABEL[current]}
            </Badge>
          ) : (
            <span className="text-sm text-slate-400">
              Pas encore en phase contrat
            </span>
          )}
        </p>
      </div>

      <label className="text-sm">
        <span className="mb-1 block text-xs text-slate-500">
          Faire évoluer le contrat
        </span>
        <Select
          value={next}
          onChange={(e) => setNext(e.target.value as ContractStatus)}
        >
          {CONTRACT_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {CONTRACT_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </label>

      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Commentaire (optionnel)"
        maxLength={500}
      />

      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}

      <div>
        <Button type="button" size="sm" onClick={submit} disabled={pending}>
          {pending ? "Mise à jour…" : "Mettre à jour le contrat"}
        </Button>
      </div>
    </div>
  );
}
