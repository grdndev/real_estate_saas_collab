"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, FolderPlus } from "lucide-react";

import { createDossierForLotAction } from "@/lib/dossier/actions";

/**
 * Accès au dossier d'un lot (T5) : un lot est toujours cliquable — soit son
 * dossier existe et on l'ouvre, soit on le crée à la volée (sans client).
 */
interface Props {
  lotId: string;
  lotReference: string;
  dossierId: string | null;
  /** Racine « dossiers » de l'espace appelant, ex. « /admin/dossiers ». */
  dossierBasePath: string;
}

export function OpenDossierCell({
  lotId,
  lotReference,
  dossierId,
  dossierBasePath,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (dossierId) {
    return (
      <a
        href={`${dossierBasePath}/${dossierId}`}
        aria-label={`Ouvrir le dossier du lot ${lotReference}`}
        className="text-equatis-turquoise-700 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium hover:underline"
      >
        <FolderOpen className="size-4" aria-hidden />
        Ouvrir le dossier
      </a>
    );
  }

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await createDossierForLotAction(lotId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`${dossierBasePath}/${result.value.dossierId}`);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={create}
        disabled={pending}
        aria-label={`Créer le dossier du lot ${lotReference}`}
        className="text-equatis-turquoise-700 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium hover:underline disabled:opacity-50"
      >
        <FolderPlus className="size-4" aria-hidden />
        {pending ? "Création…" : "Créer le dossier"}
      </button>
      {error && (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
