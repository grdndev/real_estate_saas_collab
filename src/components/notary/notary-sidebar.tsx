"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, LayoutDashboard, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  {
    href: "/notaire",
    label: "Tableau de bord",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/notaire",
    label: "Dossiers reçus",
    icon: FolderOpen,
    exact: false,
    group: "secondary",
  },
  { href: "/profil", label: "Mon profil", icon: User },
] as const;

export function NotarySidebar() {
  const pathname = usePathname();
  return (
    <aside
      aria-label="Navigation Notaire"
      className="sticky top-0 hidden h-[calc(100vh-4rem)] w-60 shrink-0 flex-col gap-1 bg-violet-700 px-3 py-4 text-sm text-violet-50 lg:flex"
    >
      <p className="px-3 pb-2 text-xs font-semibold tracking-widest text-violet-200 uppercase">
        Notaire
      </p>
      <Link
        href="/notaire"
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 transition",
          pathname === "/notaire" || pathname?.startsWith("/notaire/")
            ? "bg-violet-800 text-white"
            : "hover:bg-violet-800/60",
        )}
      >
        <FolderOpen className="size-4" aria-hidden />
        <span>Dossiers reçus</span>
      </Link>
      <Link
        href="/profil"
        className="mt-auto flex items-center gap-3 rounded-md px-3 py-2 transition hover:bg-violet-800/60"
      >
        <User className="size-4" aria-hidden />
        <span>Mon profil</span>
      </Link>
    </aside>
  );
}

void NAV;
