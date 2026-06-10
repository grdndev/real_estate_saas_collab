"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import {
  Bell,
  Building2,
  FileSignature,
  FileUp,
  LayoutDashboard,
  ListOrdered,
  MessagesSquare,
  TrendingUp,
  Users2,
  Wallet,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgrammeOption {
  id: string;
  name: string;
  reference: string;
}

export function PromoterSidebar({
  programmes,
}: {
  programmes: ProgrammeOption[];
}) {
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  const activeId = params?.id;

  const nav = activeId
    ? [
        {
          href: `/promoteur/${activeId}`,
          label: "Tableau de bord",
          icon: LayoutDashboard,
          exact: true,
        },
        {
          href: `/promoteur/${activeId}/lots`,
          label: "Grille & lots",
          icon: ListOrdered,
        },
        {
          href: `/promoteur/${activeId}/tresorerie`,
          label: "Trésorerie",
          icon: Wallet,
        },
        {
          href: `/promoteur/${activeId}/ventes`,
          label: "Suivi des ventes",
          icon: TrendingUp,
        },
        {
          href: `/promoteur/${activeId}/contrats`,
          label: "Suivi des contrats",
          icon: FileSignature,
        },
      ]
    : [];

  return (
    <aside
      aria-label="Navigation Promoteur"
      className="bg-equatis-turquoise-700 sticky top-0 hidden w-60 flex-col gap-1 px-3 py-4 text-sm text-white lg:flex"
    >
      <p className="text-equatis-turquoise-100 px-3 pb-1 text-xs font-semibold tracking-widest uppercase">
        Promoteur
      </p>
      <div className="text-equatis-turquoise-100 px-3 pb-2 text-xs">
        Choisir un programme :
      </div>
      <ul className="mb-4 space-y-0.5">
        {programmes.length === 0 ? (
          <li className="text-equatis-turquoise-100 px-3 text-xs italic">
            Aucun programme assigné.
          </li>
        ) : (
          programmes.map((p) => {
            const active = activeId === p.id;
            return (
              <li key={p.id}>
                <Link
                  href={`/promoteur/${p.id}`}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs",
                    active
                      ? "bg-equatis-turquoise-900 text-white"
                      : "text-equatis-turquoise-50 hover:bg-equatis-turquoise-800/60",
                  )}
                >
                  <Building2 className="size-3.5" aria-hidden />
                  <span className="truncate font-medium">{p.name}</span>
                </Link>
              </li>
            );
          })
        )}
      </ul>

      <p className="text-equatis-turquoise-100 px-3 pb-1 text-xs font-semibold tracking-widest uppercase">
        Espace
      </p>
      {[
        {
          href: "/promoteur/importer",
          label: "Importer un programme",
          icon: FileUp,
        },
        { href: "/promoteur/prospects", label: "Prospects", icon: Users2 },
        {
          href: "/messagerie-interne",
          label: "Messagerie interne",
          icon: MessagesSquare,
        },
        { href: "/notifications", label: "Notifications", icon: Bell },
      ].map((item) => {
        const Icon = item.icon;
        const active = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 transition",
              active
                ? "bg-equatis-turquoise-900 text-white"
                : "hover:bg-equatis-turquoise-800/60 text-equatis-turquoise-50",
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}

      {nav.length > 0 && (
        <>
          <p className="text-equatis-turquoise-100 mt-2 px-3 pb-1 text-xs font-semibold tracking-widest uppercase">
            Programme
          </p>
          {nav.map((item) => {
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
                    ? "bg-equatis-turquoise-900 text-white"
                    : "hover:bg-equatis-turquoise-800/60 text-equatis-turquoise-50",
                )}
              >
                <Icon className="size-4" aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </>
      )}

      <Link
        href="/profil"
        className="hover:bg-equatis-turquoise-800/60 text-equatis-turquoise-50 mt-auto flex items-center gap-3 rounded-md px-3 py-2 transition"
      >
        <User className="size-4" aria-hidden />
        <span>Mon profil</span>
      </Link>
    </aside>
  );
}
