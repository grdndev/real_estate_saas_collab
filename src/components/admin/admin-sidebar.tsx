"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Users2,
  Building2,
  Activity,
  Settings,
  Banknote,
  MessagesSquare,
  FileSignature,
  ListOrdered,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Tous les liens restent sous /admin : `ROLE_PREFIXES.SUPER_ADMIN` n'autorise
// que ce préfixe, un lien vers un autre espace serait redirigé par proxy.ts.
const NAV = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
  { href: "/admin/programmes", label: "Programmes", icon: Building2 },
  { href: "/admin/fonds", label: "Suivi de fonds", icon: Banknote },
  { href: "/admin/prospects", label: "Prospects", icon: Users2 },
  {
    href: "/messagerie-interne",
    label: "Messagerie interne",
    icon: MessagesSquare,
  },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings },
  { href: "/admin/logs", label: "Activité", icon: Activity },
] as const;

interface ProgrammeOption {
  id: string;
  name: string;
}

export function AdminSidebar({
  programmes = [],
}: {
  programmes?: ProgrammeOption[];
}) {
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  // L'id de programme n'est pertinent que dans la section « suivi ».
  const activeId = pathname?.startsWith("/admin/suivi/")
    ? params?.id
    : undefined;

  const suiviNav = activeId
    ? [
        {
          href: `/admin/suivi/${activeId}`,
          label: "Tableau de bord",
          icon: LayoutDashboard,
          exact: true,
        },
        {
          href: `/admin/suivi/${activeId}/lots`,
          label: "Grille & lots",
          icon: ListOrdered,
        },
        {
          href: `/admin/suivi/${activeId}/tresorerie`,
          label: "Trésorerie",
          icon: Wallet,
        },
        {
          href: `/admin/suivi/${activeId}/ventes`,
          label: "Suivi des ventes",
          icon: TrendingUp,
        },
        {
          href: `/admin/suivi/${activeId}/contrats`,
          label: "Suivi des contrats",
          icon: FileSignature,
        },
      ]
    : [];

  return (
    <aside
      aria-label="Navigation Super Admin"
      className="bg-equatis-night-900 sticky top-0 hidden w-60 flex-col gap-1 px-3 py-4 text-sm text-slate-200 lg:flex"
    >
      <p className="px-3 pb-2 text-xs font-semibold tracking-widest text-slate-400 uppercase">
        Super Admin
      </p>
      {NAV.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 transition",
              active
                ? "bg-equatis-night-800 text-white"
                : "hover:bg-equatis-night-800/60 text-slate-300",
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}

      {programmes.length > 0 && (
        <>
          <p className="mt-3 px-3 pb-1 text-xs font-semibold tracking-widest text-slate-400 uppercase">
            Suivi de programme
          </p>
          <ul className="mb-2 space-y-0.5">
            {programmes.map((p) => {
              const active = activeId === p.id;
              return (
                <li key={p.id}>
                  <Link
                    href={`/admin/suivi/${p.id}`}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs",
                      active
                        ? "bg-equatis-night-800 text-white"
                        : "hover:bg-equatis-night-800/60 text-slate-300",
                    )}
                  >
                    <Building2 className="size-3.5" aria-hidden />
                    <span className="truncate font-medium">{p.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {suiviNav.map((item) => {
        const Icon = item.icon;
        const active = item.exact
          ? pathname === item.href
          : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 transition",
              active
                ? "bg-equatis-night-800 text-white"
                : "hover:bg-equatis-night-800/60 text-slate-300",
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
