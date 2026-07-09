"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Send } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import {
  sendMessageAction,
  sendMessageByEmailAction,
} from "@/lib/client-space/actions";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/auth/actions";

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENTS_TOTAL_BYTES = 10 * 1024 * 1024; // 10 Mo
const REFRESH_INTERVAL_MS = 15_000;

export interface MessageRow {
  id: string;
  body: string;
  createdAt: Date;
  senderId: string;
  senderName: string;
  sentByEmail?: boolean;
  emailAttachmentCount?: number;
  /** Message lu par au moins un destinataire. */
  readByOthers?: boolean;
}

interface Props {
  dossierId: string;
  currentUserId: string;
  messages: MessageRow[];
  recipientLabel: string;
  canSendByEmail?: boolean;
  /** Nombre de messages plus anciens non affichés. */
  truncatedCount?: number;
}

export function MessageThread({
  dossierId,
  currentUserId,
  messages,
  recipientLabel,
  canSendByEmail,
  truncatedCount = 0,
}: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sendByEmail, setSendByEmail] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Rafraîchit le fil régulièrement pour voir arriver les réponses.
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [router]);

  const canSubmit =
    body.trim().length > 0 || (sendByEmail && attachments.length > 0);

  function addFiles(files: File[]) {
    setError(null);
    const next = [...attachments, ...files];
    if (next.length > MAX_ATTACHMENTS) {
      setError(`Au plus ${MAX_ATTACHMENTS} pièces jointes par envoi.`);
      return;
    }
    const totalBytes = next.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > MAX_ATTACHMENTS_TOTAL_BYTES) {
      setError("Les pièces jointes dépassent 10 Mo au total.");
      return;
    }
    setAttachments(next);
  }

  function submit() {
    const trimmed = body.trim();
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      let result: ActionResult<{ id: string }>;
      try {
        if (sendByEmail) {
          const fd = new FormData();
          fd.append("dossierId", dossierId);
          fd.append("body", trimmed);
          attachments.forEach((f) => fd.append("attachments", f));
          result = await sendMessageByEmailAction(fd);
        } else {
          result = await sendMessageAction({ dossierId, body: trimmed });
        }
      } catch {
        setError("L'envoi a échoué. Veuillez réessayer.");
        return;
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      setSendByEmail(false);
      setAttachments([]);
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {truncatedCount > 0 && (
          <p className="text-center text-xs text-slate-400">
            {truncatedCount} message{truncatedCount > 1 ? "s" : ""} plus ancien
            {truncatedCount > 1 ? "s" : ""} non affiché
            {truncatedCount > 1 ? "s" : ""}.
          </p>
        )}
        {messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Démarrez la conversation avec {recipientLabel}.
          </p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col gap-1",
                  isMe ? "items-end" : "items-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-line",
                    isMe
                      ? "bg-equatis-night-800 text-white"
                      : "bg-slate-100 text-slate-900",
                  )}
                >
                  {msg.body}
                  {msg.sentByEmail && (
                    <p className="mt-1 text-xs text-slate-400 italic">
                      Envoyé par e-mail
                      {msg.emailAttachmentCount
                        ? ` · ${msg.emailAttachmentCount} fichier${msg.emailAttachmentCount > 1 ? "s" : ""} joint${msg.emailAttachmentCount > 1 ? "s" : ""} à l'e-mail`
                        : ""}
                    </p>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {isMe ? "Moi" : msg.senderName} ·{" "}
                  <time
                    dateTime={msg.createdAt.toISOString()}
                    suppressHydrationWarning
                  >
                    {msg.createdAt.toLocaleString("fr-FR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </time>
                  {isMe && msg.readByOthers && " · Lu"}
                </p>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-slate-200 p-4">
        {error && (
          <Alert variant="danger" role="alert" className="mb-3">
            {error}
          </Alert>
        )}
        <div className="flex gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={`Écrire à ${recipientLabel}… (Ctrl/⌘+Entrée pour envoyer)`}
            rows={2}
            className="min-h-[72px] flex-1"
            aria-label="Nouveau message"
          />
          <Button
            onClick={submit}
            disabled={pending || !canSubmit}
            aria-label="Envoyer le message"
          >
            <Send className="size-4" aria-hidden />
            <span className="hidden sm:inline">
              {pending ? "Envoi…" : "Envoyer"}
            </span>
          </Button>
        </div>
        {canSendByEmail && (
          <div className="mt-2 flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={sendByEmail}
                onChange={(e) => {
                  setSendByEmail(e.target.checked);
                  if (!e.target.checked) setAttachments([]);
                }}
                className="h-4 w-4 rounded border-slate-300"
              />
              Par email
            </label>
            <button
              type="button"
              disabled={!sendByEmail}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Joindre des fichiers"
            >
              <Paperclip className="size-4" aria-hidden />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </div>
        )}
        {canSendByEmail && attachments.length > 0 && (
          <ul className="mt-2 space-y-1">
            {attachments.map((f, i) => (
              <li
                key={i}
                className="flex items-center gap-2 text-sm text-slate-600"
              >
                <span className="max-w-60 truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="text-slate-400 hover:text-red-500"
                  aria-label={`Retirer ${f.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
