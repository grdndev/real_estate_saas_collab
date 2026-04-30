"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/client", label: "Mon dossier", icon: LayoutDashboard },
  { href: "/client/documents", label: "Mes documents", icon: FileText },
  { href: "/client/messagerie", label: "Messagerie", icon: MessageSquare },
  { href: "/profil", label: "Mon profil", icon: User },
] as const;

export function ClientSidebar() {
  const pathname = usePathname();
  return (
    <aside
      aria-label="Navigation Client"
      className="sticky top-0 hidden h-[calc(100vh-4rem)] w-60 shrink-0 flex-col gap-1 bg-sky-700 px-3 py-4 text-sm text-sky-50 lg:flex"
    >
      <p className="px-3 pb-2 text-xs font-semibold tracking-widest text-sky-200 uppercase">
        Mon espace
      </p>
      {NAV.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/client"
            ? pathname === "/client"
            : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 transition",
              active
                ? "bg-sky-800 text-white"
                : "text-sky-100 hover:bg-sky-800/60",
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </aside>
  );
}
