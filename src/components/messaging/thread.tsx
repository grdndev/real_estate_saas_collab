"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Send } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import {
  loadOlderMessagesAction,
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
  /** Fin de la conversation, rendue par le serveur. */
  messages: MessageRow[];
  recipientLabel: string;
  canSendByEmail?: boolean;
  /**
   * Curseur des messages plus anciens, `null` quand tout le fil tient dans la
   * première tranche. Ils remontent au défilement vers le haut.
   */
  olderCursor?: string | null;
}

/** Fusionne deux ensembles de messages, sans doublon, du plus ancien au plus récent. */
function mergeMessages(...groups: MessageRow[][]): MessageRow[] {
  const byId = new Map<string, MessageRow>();
  for (const group of groups) for (const m of group) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => {
    const delta = a.createdAt.getTime() - b.createdAt.getTime();
    return delta !== 0 ? delta : a.id.localeCompare(b.id);
  });
}

export function MessageThread({
  dossierId,
  currentUserId,
  messages,
  recipientLabel,
  canSendByEmail,
  olderCursor = null,
}: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sendByEmail, setSendByEmail] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Messages déjà remontés, conservés d'un rafraîchissement à l'autre : la
  // fenêtre servie par le serveur glisse vers le récent, elle ne les contient
  // plus.
  const [older, setOlder] = useState<MessageRow[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(olderCursor);

  const scrollRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  // Le callback d'IntersectionObserver s'exécute hors du cycle de rendu et
  // lirait sinon des valeurs périmées, d'où le doublon en refs.
  const cursorRef = useRef<string | null>(olderCursor);
  const loadingRef = useRef(false);
  // Distance au bas du fil, mémorisée avant un ajout en tête pour que la vue
  // ne saute pas.
  const anchorRef = useRef<number | null>(null);
  const previousMessagesRef = useRef(messages);

  const all = useMemo(() => mergeMessages(older, messages), [older, messages]);

  // Un message sorti de la fenêtre serveur est réintégré aux plus anciens :
  // sans cela il disparaîtrait du fil à la première actualisation.
  useEffect(() => {
    const previous = previousMessagesRef.current;
    previousMessagesRef.current = messages;
    if (previous === messages || older.length === 0) return;
    const dropped = previous.filter(
      (m) => !messages.some((n) => n.id === m.id),
    );
    if (dropped.length > 0) setOlder((prev) => mergeMessages(prev, dropped));
  }, [messages, older.length]);

  const loadOlder = useCallback(async () => {
    if (loadingRef.current || cursorRef.current === null) return;
    loadingRef.current = true;
    setLoadingOlder(true);
    setOlderError(null);

    const container = scrollRef.current;
    anchorRef.current = container
      ? container.scrollHeight - container.scrollTop
      : null;

    const result = await loadOlderMessagesAction(dossierId, cursorRef.current);
    if (!result.ok) {
      setOlderError(result.error);
      anchorRef.current = null;
      setLoadingOlder(false);
      loadingRef.current = false;
      return;
    }

    setOlder((prev) => mergeMessages(result.value.rows, prev));
    cursorRef.current = result.value.nextCursor;
    setCursor(result.value.nextCursor);
    setLoadingOlder(false);
    loadingRef.current = false;
  }, [dossierId]);

  // Position d'ouverture : bas du fil, sans animation. Cet effet de mise en
  // page s'exécute avant celui qui pose l'observateur : la sentinelle du haut
  // est donc déjà hors champ quand l'observation démarre, sinon l'ouverture
  // déclencherait aussitôt un chargement.
  useLayoutEffect(() => {
    endRef.current?.scrollIntoView();
  }, []);

  // Après un ajout en tête, on restitue la distance au bas du fil.
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container || anchorRef.current === null) return;
    container.scrollTop = container.scrollHeight - anchorRef.current;
    anchorRef.current = null;
  }, [all.length]);

  useEffect(() => {
    const sentinel = topRef.current;
    if (!sentinel || cursor === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadOlder();
      },
      { root: scrollRef.current, rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, loadOlder]);

  // Nouveau message en fin de fil : on suit. Un ajout en tête ne change pas le
  // dernier identifiant et ne déclenche donc pas ce défilement.
  const lastId = all[all.length - 1]?.id;
  useEffect(() => {
    if (!lastId) return;
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastId]);

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
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {/* Sentinelle de tête : remonte les messages plus anciens. */}
        <div aria-live="polite" aria-busy={loadingOlder}>
          {cursor !== null && <div ref={topRef} aria-hidden className="h-px" />}
          {olderError ? (
            <p className="text-center text-xs">
              <span role="alert" className="text-red-700">
                {olderError}
              </span>{" "}
              <button
                type="button"
                onClick={() => void loadOlder()}
                className="text-equatis-turquoise-700 hover:underline"
              >
                Réessayer
              </button>
            </p>
          ) : loadingOlder ? (
            <p className="text-center text-xs text-slate-400">
              Chargement des messages plus anciens…
            </p>
          ) : cursor === null && all.length > 0 ? (
            <p className="text-center text-xs text-slate-400">
              Début de la conversation.
            </p>
          ) : null}
        </div>
        {all.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Démarrez la conversation avec {recipientLabel}.
          </p>
        ) : (
          all.map((msg) => {
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
