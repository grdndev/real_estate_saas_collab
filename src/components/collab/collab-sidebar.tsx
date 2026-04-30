"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderOpen, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/collaborateur", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/collaborateur/dossiers", label: "Dossiers", icon: FolderOpen },
  { href: "/collaborateur/notifications", label: "Notifications", icon: Bell },
  { href: "/profil", label: "Mon profil", icon: User },
] as const;

export function CollabSidebar() {
  const pathname = usePathname();
  return (
    <aside
      aria-label="Navigation Collaborateur"
      className="bg-equatis-night-800 sticky top-0 hidden h-[calc(100vh-4rem)] w-60 shrink-0 flex-col gap-1 px-3 py-4 text-sm text-slate-200 lg:flex"
    >
      <p className="px-3 pb-2 text-xs font-semibold tracking-widest text-slate-400 uppercase">
        Collaborateur
      </p>
      {NAV.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/collaborateur"
            ? pathname === "/collaborateur"
            : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 transition",
              active
                ? "bg-equatis-night-900 text-white"
                : "hover:bg-equatis-night-900/60 text-slate-300",
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
