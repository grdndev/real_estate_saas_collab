"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  CalendarClock,
  FileSignature,
  FileText,
  FolderClock,
  FolderPlus,
  Inbox,
  MessageSquare,
  Receipt,
  Send,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { markNotificationReadAction } from "@/lib/notifications/actions";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<string, LucideIcon> = {
  NEW_DOCUMENT: FileText,
  DOCUMENT_REQUESTED: Inbox,
  SIGNATURE_COMPLETED: FileSignature,
  DOSSIER_INACTIVE: FolderClock,
  NEW_LEAD: UserPlus,
  TRANSMITTED_TO_NOTARY: Send,
  MISSING_PIECE_REPORTED: Inbox,
  NEW_MESSAGE: MessageSquare,
  DOSSIER_ASSOCIATED: FolderPlus,
  ACT_READY: FileSignature,
  APPOINTMENT_SCHEDULED: CalendarClock,
  CONTRACT_STATUS_CHANGE: FileSignature,
  OPTION_REMINDER: FolderClock,
  INVOICE_RECEIVED: Receipt,
};

interface Props {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: Date;
  kind: string;
  kindLabel: string;
}

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `il y a ${d} j`;
  return date.toLocaleDateString("fr-FR");
}

export function NotificationRow({
  id,
  title,
  body,
  link,
  read,
  createdAt,
  kind,
  kindLabel,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const Icon = KIND_ICON[kind] ?? Bell;

  function markRead() {
    if (read || pending) return;
    startTransition(async () => {
      await markNotificationReadAction(id);
      router.refresh();
    });
  }

  const inner = (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
          read
            ? "bg-slate-100 text-slate-400"
            : "bg-equatis-turquoise-100 text-equatis-turquoise-700",
        )}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "truncate text-sm",
              read ? "text-slate-600" : "text-equatis-night-800 font-semibold",
            )}
          >
            {title}
          </p>
          {!read && (
            <span
              className="bg-equatis-turquoise-500 size-2 shrink-0 rounded-full"
              aria-label="Non lue"
            />
          )}
        </div>
        {body && (
          <p className="mt-0.5 text-xs whitespace-pre-line text-slate-500">
            {body}
          </p>
        )}
        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            {kindLabel}
          </span>
          {/* Temps relatif : horloges serveur/client différentes au SSR. */}
          <time dateTime={createdAt.toISOString()} suppressHydrationWarning>
            {relativeTime(createdAt)}
          </time>
        </p>
      </div>
    </div>
  );

  return (
    <li
      className={cn(
        "px-4 py-3 transition-colors",
        !read && "bg-equatis-turquoise-50/40",
      )}
    >
      {link ? (
        <Link href={link} onClick={markRead} className="block hover:opacity-80">
          {inner}
        </Link>
      ) : (
        <button
          type="button"
          onClick={markRead}
          className="block w-full text-left hover:opacity-80"
        >
          {inner}
        </button>
      )}
    </li>
  );
}
