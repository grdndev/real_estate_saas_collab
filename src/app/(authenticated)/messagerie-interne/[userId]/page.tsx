import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { DirectMessageComposer } from "@/components/messaging/direct-message-composer";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { markConversationReadAction } from "@/lib/messaging/actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Conversation" };

const INTERNAL_ROLES = [
  "COLLABORATOR",
  "PROMOTER",
  "NOTARY",
  "SUPER_ADMIN",
] as const;

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  COLLABORATOR: "Collaborateur",
  PROMOTER: "Promoteur",
  NOTARY: "Notaire",
};

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function ConversationPage({ params }: PageProps) {
  const me = await requireRole([...INTERNAL_ROLES]);
  const { userId } = await params;

  const other = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      deletedAt: true,
    },
  });
  if (
    !other ||
    other.deletedAt ||
    !INTERNAL_ROLES.includes(other.role as (typeof INTERNAL_ROLES)[number])
  ) {
    notFound();
  }

  await markConversationReadAction(other.id);

  const messages = await prisma.directMessage.findMany({
    where: {
      OR: [
        { senderId: me.id, recipientId: other.id },
        { senderId: other.id, recipientId: me.id },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href="/messagerie-interne"
        className="text-equatis-turquoise-700 text-sm hover:underline"
      >
        ← Toutes les conversations
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <span
          className="bg-equatis-night-700 flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          aria-hidden
        >
          {`${other.firstName[0] ?? ""}${other.lastName[0] ?? ""}`.toUpperCase()}
        </span>
        <div>
          <h1 className="text-equatis-night-800 text-xl font-semibold">
            {other.firstName} {other.lastName}
          </h1>
          <p className="text-xs text-slate-500">
            {ROLE_LABEL[other.role] ?? other.role}
          </p>
        </div>
      </div>

      <Card className="mt-5">
        <CardContent className="flex flex-col gap-3 py-5">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Aucun message. Démarrez la conversation ci-dessous.
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.senderId === me.id;
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex flex-col",
                    mine ? "items-end" : "items-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                      mine
                        ? "bg-equatis-turquoise-600 text-white"
                        : "bg-slate-100 text-slate-800",
                    )}
                  >
                    {m.body && <p className="whitespace-pre-line">{m.body}</p>}
                    {m.attachmentKey && (
                      <a
                        href={`/messagerie-interne/attachment/${m.id}`}
                        className={cn(
                          "mt-1 inline-block text-xs underline",
                          mine ? "text-white" : "text-equatis-turquoise-700",
                        )}
                      >
                        📎 {m.attachmentName ?? "Document joint"}
                      </a>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {m.createdAt.toLocaleString("fr-FR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <div className="mt-4">
        <DirectMessageComposer recipientId={other.id} />
      </div>
    </div>
  );
}
