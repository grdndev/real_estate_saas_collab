"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { markNotificationReadAction } from "@/lib/notifications/actions";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: Date;
  kindLabel: string;
}

export function NotificationRow({
  id,
  title,
  body,
  link,
  read,
  createdAt,
  kindLabel,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function markRead() {
    if (read || pending) return;
    startTransition(async () => {
      await markNotificationReadAction(id);
      router.refresh();
    });
  }

  const inner = (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <p
          className={cn(
            "text-sm",
            read ? "text-slate-600" : "text-equatis-night-800 font-semibold",
          )}
        >
          {title}
        </p>
        {!read && <Badge variant="accent">Nouveau</Badge>}
      </div>
      {body && <p className="text-xs text-slate-500">{body}</p>}
      <p className="text-xs text-slate-400">
        <span>{kindLabel}</span>
        {" · "}
        <time dateTime={createdAt.toISOString()}>
          {createdAt.toLocaleString("fr-FR")}
        </time>
      </p>
    </div>
  );

  return (
    <li
      className={cn(
        "flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0",
        !read && "bg-equatis-turquoise-50/40",
      )}
    >
      {link ? (
        <Link href={link} onClick={markRead} className="flex-1 hover:underline">
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={markRead} className="flex-1 text-left">
          {inner}
        </button>
      )}
    </li>
  );
}
