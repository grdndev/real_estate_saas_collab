"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { sendMessageAction } from "@/lib/client-space/actions";
import { cn } from "@/lib/utils";

export interface MessageRow {
  id: string;
  body: string;
  createdAt: Date;
  senderId: string;
  senderName: string;
}

interface Props {
  dossierId: string;
  currentUserId: string;
  messages: MessageRow[];
  recipientLabel: string;
}

export function MessageThread({
  dossierId,
  currentUserId,
  messages,
  recipientLabel,
}: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function submit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const result = await sendMessageAction({ dossierId, body: trimmed });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
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
                </div>
                <p className="text-xs text-slate-400">
                  {isMe ? "Moi" : msg.senderName} ·{" "}
                  {msg.createdAt.toLocaleString("fr-FR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
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
            disabled={pending || body.trim().length === 0}
            aria-label="Envoyer le message"
          >
            <Send className="size-4" aria-hidden />
            <span className="hidden sm:inline">
              {pending ? "Envoi…" : "Envoyer"}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
