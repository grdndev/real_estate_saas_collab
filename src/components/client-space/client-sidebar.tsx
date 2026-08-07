"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";

/** Un dossier = un lot acheté. Un client peut en porter plusieurs. */
export interface ClientDossierLink {
  id: string;
  label: string;
  unreadMessages: number;
}

interface Props {
  dossiers: ClientDossierLink[];
}

/** Extrait l'identifiant du dossier courant de l'URL `/client/<id>/…`. */
function currentDossierId(pathname: string | null): string | null {
  const segments = pathname?.split("/").filter(Boolean) ?? [];
  return segments[0] === "client" && segments[1] ? segments[1] : null;
}

export function ClientSidebar({ dossiers }: Props) {
  const pathname = usePathname();
  const activeId = currentDossierId(pathname) ?? dossiers[0]?.id ?? null;
  const activeDossier = dossiers.find((d) => d.id === activeId) ?? null;

  const nav = activeId
    ? [
        {
          href: `/client/${activeId}`,
          label: "Mon dossier",
          icon: LayoutDashboard,
          exact: true,
          badge: 0,
        },
        {
          href: `/client/${activeId}/documents`,
          label: "Mes documents",
          icon: FileText,
          exact: false,
          badge: 0,
        },
        {
          href: `/client/${activeId}/messagerie`,
          label: "Messagerie",
          icon: MessageSquare,
          exact: false,
          badge: activeDossier?.unreadMessages ?? 0,
        },
        {
          href: "/profil",
          label: "Mon profil",
          icon: User,
          exact: false,
          badge: 0,
        },
      ]
    : [
        {
          href: "/profil",
          label: "Mon profil",
          icon: User,
          exact: false,
          badge: 0,
        },
      ];

  return (
    <aside
      aria-label="Navigation Client"
      className="sticky top-0 hidden w-60 flex-col gap-1 bg-sky-700 px-3 py-4 text-sm text-sky-50 lg:flex"
    >
      <p className="px-3 pb-2 text-xs font-semibold tracking-widest text-sky-200 uppercase">
        Mon espace
      </p>

      {/* Sélecteur de dossier — un client peut acheter plusieurs lots. */}
      {dossiers.length > 1 && (
        <div className="mb-2 flex flex-col gap-1 border-b border-sky-600 pb-3">
          <Link
            href="/client"
            className="rounded-md px-3 py-1.5 text-xs text-sky-200 hover:bg-sky-800/60"
          >
            ← Tous mes dossiers
          </Link>
          {dossiers.map((d) => (
            <Link
              key={d.id}
              href={`/client/${d.id}`}
              aria-current={d.id === activeId ? "true" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition",
                d.id === activeId
                  ? "bg-sky-800 text-white"
                  : "text-sky-100 hover:bg-sky-800/60",
              )}
            >
              <span className="truncate">{d.label}</span>
              {d.unreadMessages > 0 && (
                <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
                  {d.unreadMessages > 99 ? "99+" : d.unreadMessages}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

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
                ? "bg-sky-800 text-white"
                : "text-sky-100 hover:bg-sky-800/60",
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span>{item.label}</span>
            {item.badge > 0 && (
              <span
                className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white"
                aria-label={`${item.badge} message${item.badge > 1 ? "s" : ""} non lu${item.badge > 1 ? "s" : ""}`}
              >
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </aside>
  );
}
