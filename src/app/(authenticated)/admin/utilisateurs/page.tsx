import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  EmptyState,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui/table";
import { UserRowActions } from "@/components/admin/user-row-actions";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Utilisateurs · Admin" };

const ROLE_LABEL = {
  SUPER_ADMIN: "Super Admin",
  COLLABORATOR: "Collaborateur",
  PROMOTER: "Promoteur",
  NOTARY: "Notaire",
  CLIENT: "Client",
} as const;

const STATUS_BADGE = {
  ACTIVE: { label: "Actif", variant: "success" as const },
  PENDING_EMAIL: { label: "Email à confirmer", variant: "warning" as const },
  PENDING_ASSOCIATION: {
    label: "Attente association",
    variant: "info" as const,
  },
  SUSPENDED: { label: "Désactivé", variant: "danger" as const },
  DELETION_REQUESTED: {
    label: "Suppression demandée",
    variant: "danger" as const,
  },
};

export default async function AdminUsersPage() {
  const me = await requireRole("SUPER_ADMIN");

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
            Utilisateurs
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {users.length} compte{users.length > 1 ? "s" : ""} —{" "}
            {users.filter((u) => u.status === "ACTIVE").length} actif
            {users.filter((u) => u.status === "ACTIVE").length > 1 ? "s" : ""}.
          </p>
        </div>
        <Link href="/admin/utilisateurs/inviter">
          <Button>Inviter un utilisateur</Button>
        </Link>
      </div>

      <Card>
        {users.length === 0 ? (
          <EmptyState
            title="Aucun utilisateur"
            description="Commencez par inviter un collaborateur, un promoteur ou un notaire."
            action={
              <Link href="/admin/utilisateurs/inviter">
                <Button>Inviter un utilisateur</Button>
              </Link>
            }
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Nom</Th>
                <Th>Email</Th>
                <Th>Rôle</Th>
                <Th>Statut</Th>
                <Th>Dernière connexion</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {users.map((u) => {
                const badge = STATUS_BADGE[u.status];
                return (
                  <Tr key={u.id}>
                    <Td className="font-medium">
                      {u.firstName} {u.lastName}
                    </Td>
                    <Td className="text-slate-600">{u.email}</Td>
                    <Td>
                      <Badge variant="primary">{ROLE_LABEL[u.role]}</Badge>
                    </Td>
                    <Td>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </Td>
                    <Td className="text-xs text-slate-500">
                      {u.lastLoginAt
                        ? u.lastLoginAt.toLocaleString("fr-FR")
                        : "—"}
                    </Td>
                    <Td className="text-right">
                      <UserRowActions
                        userId={u.id}
                        active={u.status === "ACTIVE"}
                        isSelf={u.id === me.id}
                      />
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
