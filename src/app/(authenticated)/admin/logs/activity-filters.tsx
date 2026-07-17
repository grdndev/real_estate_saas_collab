"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ACTION_LABEL } from "@/lib/admin/activity-labels";

export type ActivityVue = "tout" | "utilisateur" | "programme" | "dossier";

export interface ActivityFilterValues {
  vue: ActivityVue;
  id: string;
  action: string;
  du: string;
  au: string;
}

interface ActivityFiltersProps {
  values: ActivityFilterValues;
  users: { id: string; firstName: string; lastName: string; role: string }[];
  programmes: { id: string; name: string }[];
  dossiers: {
    id: string;
    reference: string;
    client: { firstName: string; lastName: string } | null;
    programme: { name: string };
  }[];
}

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  COLLABORATOR: "Collaborateurs",
  PROMOTER: "Promoteurs",
  NOTARY: "Notaires",
  CLIENT: "Clients",
};

export function ActivityFilters({
  values,
  users,
  programmes,
  dossiers,
}: ActivityFiltersProps) {
  const router = useRouter();

  const apply = (patch: Partial<ActivityFilterValues>) => {
    const next = { ...values, ...patch };
    const params = new URLSearchParams();
    if (next.vue !== "tout") params.set("vue", next.vue);
    if (next.vue !== "tout" && next.id) params.set("id", next.id);
    if (next.action) params.set("action", next.action);
    if (next.du) params.set("du", next.du);
    if (next.au) params.set("au", next.au);
    const query = params.toString();
    router.replace(query ? `/admin/logs?${query}` : "/admin/logs");
  };

  const usersByRole = new Map<string, typeof users>();
  for (const user of users) {
    const group = usersByRole.get(user.role) ?? [];
    group.push(user);
    usersByRole.set(user.role, group);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="activity-vue">Axe de consultation</Label>
        <Select
          id="activity-vue"
          value={values.vue}
          onChange={(e) =>
            apply({ vue: e.target.value as ActivityVue, id: "" })
          }
        >
          <option value="tout">Toute l&apos;activité</option>
          <option value="utilisateur">Par utilisateur</option>
          <option value="programme">Par programme</option>
          <option value="dossier">Par dossier</option>
        </Select>
      </div>

      {values.vue === "utilisateur" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="activity-user">Utilisateur</Label>
          <Select
            id="activity-user"
            value={values.id}
            onChange={(e) => apply({ id: e.target.value })}
          >
            <option value="">— Choisir un utilisateur —</option>
            {[...usersByRole.entries()].map(([role, group]) => (
              <optgroup key={role} label={ROLE_LABEL[role] ?? role}>
                {group.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
      )}

      {values.vue === "programme" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="activity-programme">Programme</Label>
          <Select
            id="activity-programme"
            value={values.id}
            onChange={(e) => apply({ id: e.target.value })}
          >
            <option value="">— Choisir un programme —</option>
            {programmes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {values.vue === "dossier" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="activity-dossier">Dossier</Label>
          <Select
            id="activity-dossier"
            value={values.id}
            onChange={(e) => apply({ id: e.target.value })}
          >
            <option value="">— Choisir un dossier —</option>
            {dossiers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.reference}
                {d.client
                  ? ` — ${d.client.firstName} ${d.client.lastName}`
                  : ""}{" "}
                ({d.programme.name})
              </option>
            ))}
          </Select>
        </div>
      )}

      {false && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="activity-action">Type d&apos;action</Label>
          <Select
            id="activity-action"
            value={values.action}
            onChange={(e) => apply({ action: e.target.value })}
          >
            <option value="">Toutes les actions</option>
            {Object.entries(ACTION_LABEL).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="activity-du">Du</Label>
        <Input
          id="activity-du"
          type="date"
          value={values.du}
          max={values.au || undefined}
          onChange={(e) => apply({ du: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="activity-au">Au</Label>
        <Input
          id="activity-au"
          type="date"
          value={values.au}
          min={values.du || undefined}
          onChange={(e) => apply({ au: e.target.value })}
        />
      </div>
    </div>
  );
}
