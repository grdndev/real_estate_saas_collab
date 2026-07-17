"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, X } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";
import { transmitToNotaryAction } from "@/lib/notary/actions";
import {
  MAX_NOTARY_ATTACHMENT_FILES,
  MAX_NOTARY_ATTACHMENT_TOTAL_BYTES,
} from "@/lib/notary/schemas";
import {
  confirmUploadAction,
  prepareUploadAction,
} from "@/lib/storage/actions";
import { ALLOWED_MIME, MAX_FILE_BYTES } from "@/lib/storage/schemas";

const ALLOWED_MIME_LIST: string[] = [...ALLOWED_MIME];
const ACCEPT_ATTR = ALLOWED_MIME_LIST.join(",");

interface NotaryOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Props {
  dossierId: string;
  notaries: NotaryOption[];
  currentNotaryId: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

export function TransmitNotaryForm({
  dossierId,
  notaries,
  currentNotaryId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notaryId, setNotaryId] = useState(currentNotaryId ?? "");
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (notaries.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucun notaire actif. Demandez à l&apos;administrateur d&apos;en inviter
        un.
      </p>
    );
  }

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const tooManyFiles = files.length > MAX_NOTARY_ATTACHMENT_FILES;
  const tooHeavy = totalBytes > MAX_NOTARY_ATTACHMENT_TOTAL_BYTES;
  const attachmentsInvalid = tooManyFiles || tooHeavy;

  // Retransmission : le notaire sélectionné est déjà assigné — on n'autorise
  // la soumission que si des fichiers sont joints (envoi email uniquement).
  const isRetransmission = Boolean(notaryId) && notaryId === currentNotaryId;
  const canSubmit =
    Boolean(notaryId) &&
    !pending &&
    !attachmentsInvalid &&
    (!isRetransmission || files.length > 0);

  function addFiles(selected: File[]) {
    setError(null);
    for (const file of selected) {
      if (!ALLOWED_MIME_LIST.includes(file.type)) {
        setError(
          `« ${file.name} » : format non autorisé (PDF, JPG, PNG, DOCX).`,
        );
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(`« ${file.name} » : fichier trop volumineux (max 20 Mo).`);
        return;
      }
    }
    setFiles((prev) => [...prev, ...selected]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      // 1. Enregistrer chaque pièce jointe comme document du dossier via le
      //    pipeline d'upload existant (isShared=false par défaut, scan déclenché).
      const documentIds: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        setProgress(`Envoi du fichier ${i + 1} / ${files.length}…`);
        const prepared = await prepareUploadAction({
          dossierId,
          documentRequestId: null,
          fileName: file.name,
          mimeType: file.type as (typeof ALLOWED_MIME)[number],
          sizeBytes: file.size,
          source: "COLLABORATOR_UPLOAD",
        });
        if (!prepared.ok) {
          setError(prepared.error);
          setProgress(null);
          setConfirm(false);
          return;
        }
        try {
          const response = await fetch(prepared.value.uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
          });
          if (!response.ok) {
            throw new Error(`Échec upload (${response.status})`);
          }
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Échec de l'envoi du fichier vers le stockage.",
          );
          setProgress(null);
          setConfirm(false);
          return;
        }
        const confirmed = await confirmUploadAction({
          documentId: prepared.value.documentId,
          skipNotifications: true,
        });
        if (!confirmed.ok) {
          setError(confirmed.error);
          setProgress(null);
          setConfirm(false);
          return;
        }
        documentIds.push(prepared.value.documentId);
      }

      // 2. Transmission (ou envoi seul si retransmission) avec email + PJ.
      setProgress(files.length > 0 ? "Envoi de l'email au notaire…" : null);
      const result = await transmitToNotaryAction({
        dossierId,
        notaryId,
        comment: comment || undefined,
        documentIds,
      });
      setProgress(null);
      setConfirm(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setComment("");
      setFiles([]);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      <Select
        value={notaryId}
        onChange={(e) => setNotaryId(e.target.value)}
        aria-label="Choisir un notaire"
      >
        <option value="">Sélectionner un notaire…</option>
        {notaries.map((n) => (
          <option key={n.id} value={n.id}>
            {n.firstName} {n.lastName} ({n.email})
          </option>
        ))}
      </Select>
      <Textarea
        rows={2}
        placeholder="Note pour le notaire (optionnel)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          className="sr-only"
          onChange={(e) => {
            const selected = Array.from(e.target.files ?? []);
            if (selected.length) addFiles(selected);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="text-equatis-turquoise-700 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        >
          <Paperclip className="size-4" aria-hidden />
          Joindre des pièces (envoyées par email au notaire)
        </button>
        {files.length > 0 && (
          <ul className="space-y-1">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700"
              >
                <span className="truncate">
                  {file.name}{" "}
                  <span className="text-slate-400">
                    ({formatBytes(file.size)})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  disabled={pending}
                  aria-label={`Retirer ${file.name}`}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
            <li className="px-2 text-xs text-slate-500">
              Total : {files.length} fichier(s) — {formatBytes(totalBytes)} /{" "}
              {formatBytes(MAX_NOTARY_ATTACHMENT_TOTAL_BYTES)}
            </li>
          </ul>
        )}
        {tooManyFiles && (
          <Alert variant="danger" role="alert">
            Maximum {MAX_NOTARY_ATTACHMENT_FILES} fichiers par envoi. Retirez-en{" "}
            {files.length - MAX_NOTARY_ATTACHMENT_FILES}.
          </Alert>
        )}
        {tooHeavy && (
          <Alert variant="danger" role="alert">
            Pièces jointes trop volumineuses : {formatBytes(totalBytes)} pour un
            maximum de {formatBytes(MAX_NOTARY_ATTACHMENT_TOTAL_BYTES)} par
            email. Retirez des fichiers.
          </Alert>
        )}
      </div>
      {progress && <p className="text-xs text-slate-500">{progress}</p>}
      <div className="flex justify-end">
        <Button onClick={() => setConfirm(true)} disabled={!canSubmit}>
          {isRetransmission
            ? "Envoyer les documents"
            : currentNotaryId
              ? "Changer de notaire"
              : "Transmettre au notaire"}
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        title={
          isRetransmission
            ? "Envoyer les documents au notaire ?"
            : "Transmettre ce dossier au notaire ?"
        }
        description={
          isRetransmission
            ? `Les ${files.length} document(s) seront envoyés par email au notaire assigné et enregistrés dans le dossier (non visibles du client par défaut). Le notaire n'est pas réassigné et le statut du dossier ne change pas.`
            : `Le notaire sélectionné aura accès au dossier en lecture, pourra signaler des pièces manquantes et confirmer la signature de l'acte. Le statut passe à « Envoyé chez le notaire ».${
                files.length > 0
                  ? ` Les ${files.length} document(s) joints seront envoyés par email et enregistrés dans le dossier (non visibles du client par défaut).`
                  : ""
              }`
        }
        confirmLabel={isRetransmission ? "Envoyer" : "Transmettre"}
        pending={pending}
        onCancel={() => setConfirm(false)}
        onConfirm={submit}
      />
    </div>
  );
}
