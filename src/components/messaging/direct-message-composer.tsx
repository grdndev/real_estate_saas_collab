"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Send, X } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { sendDirectMessageAction } from "@/lib/messaging/actions";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      resolve(r.slice(r.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Lecture impossible."));
    reader.readAsDataURL(file);
  });
}

export function DirectMessageComposer({
  recipientId,
}: {
  recipientId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function send() {
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!body.trim() && !file) {
      setError("Saisissez un message ou joignez un document.");
      return;
    }
    startTransition(async () => {
      const result = await sendDirectMessageAction({
        recipientId,
        body,
        attachmentB64: file ? await fileToBase64(file) : "",
        attachmentName: file?.name ?? "",
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      setFileName(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Votre message…"
        maxLength={4000}
      />
      {fileName && (
        <p className="flex items-center gap-1 text-xs text-slate-600">
          <Paperclip className="size-3" aria-hidden />
          {fileName}
          <button
            type="button"
            onClick={() => {
              setFileName(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
            className="text-red-600"
            aria-label="Retirer le document"
          >
            <X className="size-3" />
          </button>
        </p>
      )}
      <div className="flex items-center justify-between">
        <label className="text-equatis-turquoise-700 inline-flex cursor-pointer items-center gap-1 text-sm hover:underline">
          <Paperclip className="size-4" aria-hidden />
          Joindre un document
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>
        <Button type="button" size="sm" onClick={send} disabled={pending}>
          <Send className="size-4" aria-hidden />
          {pending ? "Envoi…" : "Envoyer"}
        </Button>
      </div>
    </div>
  );
}
