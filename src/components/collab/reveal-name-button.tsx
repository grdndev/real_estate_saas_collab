"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { revealClientNameAction } from "@/lib/dossier/actions";
import { maskName } from "@/lib/utils";

interface Props {
  dossierId: string;
  fallbackMasked: string;
}

export function RevealNameButton({ dossierId, fallbackMasked }: Props) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    if (revealed) {
      setRevealed(null);
      return;
    }
    startTransition(async () => {
      const result = await revealClientNameAction(dossierId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRevealed(`${result.value.firstName} ${result.value.lastName}`);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded text-xs hover:underline focus-visible:outline-2"
      aria-label={
        revealed ? "Masquer le nom" : "Révéler le nom (action tracée)"
      }
      title={
        revealed
          ? "Masquer le nom"
          : "Révéler le nom — l'action est inscrite dans le journal d'audit"
      }
    >
      {revealed ? (
        <>
          <EyeOff className="size-3" aria-hidden />
          <span className="font-medium">{revealed}</span>
        </>
      ) : (
        <>
          <Eye className="size-3" aria-hidden />
          <span className="font-mono">
            {pending ? "…" : (error ?? fallbackMasked)}
          </span>
        </>
      )}
    </button>
  );
}

export function MaskedName({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}) {
  return (
    <span className="font-mono text-xs text-slate-600">
      {maskName(`${firstName} ${lastName}`)}
    </span>
  );
}
