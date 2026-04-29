"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, KeyRound, UserCheck, UserX, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  forceResetUserPasswordAction,
  revokeUserSessionsAction,
  setUserStatusAction,
} from "@/lib/admin/actions";

interface Props {
  userId: string;
  active: boolean;
  isSelf: boolean;
}

type Pending =
  | { kind: "deactivate" }
  | { kind: "activate" }
  | { kind: "reset" }
  | { kind: "revoke" }
  | null;

export function UserRowActions({ userId, active, isSelf }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<Pending>(null);
  const [open, setOpen] = useState(false);

  if (isSelf) {
    return <span className="text-xs text-slate-400">vous-même</span>;
  }

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      setConfirm(null);
      router.refresh();
    });
  }

  return (
    <div className="relative inline-block text-left">
      <Button
        variant="ghost"
        size="sm"
        aria-label="Actions"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical className="size-4" aria-hidden />
      </Button>
      {open && (
        <div
          className="absolute right-0 z-10 mt-1 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-slate-200 focus:outline-none"
          role="menu"
        >
          <ul className="py-1 text-sm">
            <li>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-4 py-2 hover:bg-slate-50"
                onClick={() => {
                  setOpen(false);
                  setConfirm({ kind: "reset" });
                }}
              >
                <KeyRound className="size-4" aria-hidden />
                Forcer le reset mot de passe
              </button>
            </li>
            <li>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-4 py-2 hover:bg-slate-50"
                onClick={() => {
                  setOpen(false);
                  setConfirm({ kind: "revoke" });
                }}
              >
                <LogOut className="size-4" aria-hidden />
                Révoquer les sessions
              </button>
            </li>
            <li>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-4 py-2 text-red-700 hover:bg-red-50"
                onClick={() => {
                  setOpen(false);
                  setConfirm({ kind: active ? "deactivate" : "activate" });
                }}
              >
                {active ? (
                  <>
                    <UserX className="size-4" aria-hidden />
                    Désactiver le compte
                  </>
                ) : (
                  <>
                    <UserCheck className="size-4" aria-hidden />
                    Réactiver le compte
                  </>
                )}
              </button>
            </li>
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={confirm?.kind === "deactivate"}
        title="Désactiver ce compte ?"
        description="L'utilisateur ne pourra plus se connecter et ses sessions actives seront révoquées."
        confirmLabel="Désactiver"
        destructive
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => setUserStatusAction(userId, false))}
      />
      <ConfirmDialog
        open={confirm?.kind === "activate"}
        title="Réactiver ce compte ?"
        description="L'utilisateur retrouvera l'accès à son espace dès sa prochaine connexion."
        confirmLabel="Réactiver"
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => setUserStatusAction(userId, true))}
      />
      <ConfirmDialog
        open={confirm?.kind === "reset"}
        title="Forcer une réinitialisation de mot de passe ?"
        description="Toutes les sessions actives seront révoquées et un email contenant un lien de réinitialisation sera envoyé."
        confirmLabel="Envoyer le lien"
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => forceResetUserPasswordAction(userId))}
      />
      <ConfirmDialog
        open={confirm?.kind === "revoke"}
        title="Révoquer toutes les sessions ?"
        description="L'utilisateur sera déconnecté immédiatement de tous ses appareils."
        confirmLabel="Révoquer"
        destructive
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => revokeUserSessionsAction(userId))}
      />
    </div>
  );
}
