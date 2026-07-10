import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { getUserContext } from "@/lib/admin/activity";

type UserContext = NonNullable<Awaited<ReturnType<typeof getUserContext>>>;

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  COLLABORATOR: "Collaborateur",
  PROMOTER: "Promoteur",
  NOTARY: "Notaire",
  CLIENT: "Client",
};

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

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs tracking-wider text-slate-500 uppercase">
        {label}
      </dt>
      <dd className="text-equatis-night-800 mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

export function UserContextPanel({ user }: { user: UserContext }) {
  const statusBadge = STATUS_BADGE[user.status];

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between">
        <CardTitle>
          {user.firstName} {user.lastName}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="primary">{ROLE_LABEL[user.role] ?? user.role}</Badge>
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Fact label="Email">{user.email}</Fact>
          <Fact label="Compte créé le">
            {user.createdAt.toLocaleDateString("fr-FR")}
          </Fact>
          <Fact label="Dernière connexion">
            {user.lastLoginAt ? user.lastLoginAt.toLocaleString("fr-FR") : "—"}
          </Fact>
        </dl>
      </CardContent>
    </Card>
  );
}
