"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StickyNote, Trash2 } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { addNoteAction, deleteNoteAction } from "@/lib/notes/actions";

export interface NoteItem {
  id: string;
  body: string;
  authorName: string;
  authorId: string;
  createdAt: string;
}

interface Props {
  scope: "PROSPECT" | "DOSSIER";
  targetId: string;
  notes: NoteItem[];
  currentUserId: string;
}

export function SharedNotes({ scope, targetId, notes, currentUserId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (body.trim().length === 0) {
      setError("Saisissez une note.");
      return;
    }
    startTransition(async () => {
      const result = await addNoteAction({
        scope,
        prospectId: scope === "PROSPECT" ? targetId : null,
        dossierId: scope === "DOSSIER" ? targetId : null,
        body,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteNoteAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <StickyNote className="size-3.5" aria-hidden />
        Notes visibles et modifiables par toute l&apos;équipe.
      </p>

      {notes.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune note pour le moment.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm"
            >
              <p className="whitespace-pre-line text-slate-800">{n.body}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>
                  {n.authorName} ·{" "}
                  <time
                    dateTime={new Date(n.createdAt).toISOString()}
                    suppressHydrationWarning
                  >
                    {new Date(n.createdAt).toLocaleString("fr-FR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </time>
                </span>
                {n.authorId === currentUserId && (
                  <button
                    type="button"
                    onClick={() => remove(n.id)}
                    disabled={pending}
                    className="inline-flex items-center gap-1 text-red-600 hover:underline disabled:opacity-50"
                  >
                    <Trash2 className="size-3" aria-hidden />
                    Supprimer
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Ajouter une note pour l'équipe…"
        maxLength={2000}
      />
      <div>
        <Button type="button" size="sm" onClick={submit} disabled={pending}>
          {pending ? "Enregistrement…" : "Ajouter la note"}
        </Button>
      </div>
    </div>
  );
}
