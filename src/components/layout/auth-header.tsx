import Link from "next/link";
import { LogOut, User } from "lucide-react";
import { auth } from "@/auth";
import { NotificationsBell } from "@/components/notifications/notifications-bell";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  COLLABORATOR: "Collaborateur",
  PROMOTER: "Promoteur",
  NOTARY: "Notaire",
  CLIENT: "Client",
};

export async function AuthHeader() {
  const session = await auth();
  const userName = session?.user?.name ?? session?.user?.email ?? "—";
  const roleLabel = session?.user?.role
    ? (ROLE_LABEL[session.user.role] ?? "Utilisateur")
    : "";

  return (
    <header className="bg-equatis-surface border-b border-slate-200">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-equatis-night-800 text-sm font-bold tracking-widest uppercase"
        >
          Équatis
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <NotificationsBell />
          <Link
            href="/profil"
            className="text-equatis-night-700 hover:bg-equatis-night-50 inline-flex h-9 items-center gap-2 rounded-md px-3 transition"
          >
            <User className="size-4" aria-hidden />
            <span className="hidden sm:inline">{userName}</span>
            {roleLabel && (
              <span className="bg-equatis-turquoise-100 text-equatis-turquoise-800 hidden rounded-full px-2 py-0.5 text-xs font-medium sm:inline">
                {roleLabel}
              </span>
            )}
          </Link>
          <Link
            href="/deconnexion"
            className="text-equatis-night-700 hover:bg-equatis-night-50 inline-flex h-9 items-center gap-2 rounded-md px-3 transition"
          >
            <LogOut className="size-4" aria-hidden />
            <span className="hidden sm:inline">Déconnexion</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
