"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  Bell,
  Building2,
  Hourglass,
  MessagesSquare,
  Receipt,
  User,
  Users2,
  ChartLine,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/collaborateur", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/collaborateur/dossiers", label: "Dossiers", icon: FolderOpen },
  { href: "/collaborateur/programmes", label: "Programmes", icon: Building2 },
  { href: "/collaborateur/prospects", label: "Prospects", icon: Users2 },
  {
    href: "/collaborateur/clients-en-attente",
    label: "Clients en attente",
    icon: Hourglass,
  },
  { href: "/collaborateur/facturation", label: "Facturation", icon: Receipt },
  { href: "/collaborateur/fonds", label: "Suivi des fonds", icon: ChartLine },
  {
    href: "/messagerie-interne",
    label: "Messagerie interne",
    icon: MessagesSquare,
  },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profil", label: "Mon profil", icon: User },
] as const;

export function CollabSidebar() {
  const pathname = usePathname();
  return (
    <aside
      aria-label="Navigation Collaborateur"
      className="bg-equatis-night-800 sticky top-0 hidden w-60 flex-col gap-1 px-3 py-4 text-sm text-slate-200 lg:flex"
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
