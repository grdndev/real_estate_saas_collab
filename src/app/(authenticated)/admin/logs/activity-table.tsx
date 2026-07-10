import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  EmptyState,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui/table";
import type { ActivityPage } from "@/lib/admin/activity";
import {
  actionBadge,
  actionLabel,
  resourceTypeLabel,
} from "@/lib/admin/activity-labels";

interface ActivityTableProps {
  data: ActivityPage;
  /** Paramètres d'URL courants (hors page), pour les liens de pagination. */
  baseParams: Record<string, string>;
}

function pageHref(baseParams: Record<string, string>, page: number): string {
  const params = new URLSearchParams(baseParams);
  if (page > 0) params.set("page", String(page + 1));
  const query = params.toString();
  return query ? `/admin/logs?${query}` : "/admin/logs";
}

/** Lien de bascule vers la vue dédiée quand la ressource est un dossier ou un programme. */
function resourceHref(resourceType: string, resourceId: string | null) {
  if (!resourceId) return null;
  if (resourceType === "Dossier") {
    return `/admin/logs?vue=dossier&id=${resourceId}`;
  }
  if (resourceType === "Programme") {
    return `/admin/logs?vue=programme&id=${resourceId}`;
  }
  return null;
}

export function ActivityTable({ data, baseParams }: ActivityTableProps) {
  if (data.total === 0) {
    return (
      <EmptyState
        title="Aucune activité"
        description="Aucune entrée ne correspond aux critères sélectionnés."
      />
    );
  }

  return (
    <div>
      <Table>
        <THead>
          <Tr>
            <Th>Date</Th>
            <Th>Action</Th>
            <Th>Acteur</Th>
            <Th>Ressource</Th>
            <Th>Détails</Th>
          </Tr>
        </THead>
        <TBody>
          {data.logs.map((log) => {
            const href = resourceHref(log.resourceType, log.resourceId);
            return (
              <Tr key={log.id}>
                <Td className="text-xs whitespace-nowrap text-slate-500">
                  {log.createdAt.toLocaleString("fr-FR")}
                </Td>
                <Td>
                  <Badge variant={actionBadge(log.action)}>
                    {actionLabel(log.action)}
                  </Badge>
                </Td>
                <Td className="whitespace-nowrap">
                  {log.user ? (
                    `${log.user.firstName} ${log.user.lastName}`
                  ) : (
                    <span className="text-slate-500 italic">Système</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap">
                  {href ? (
                    <Link
                      href={href}
                      className="text-equatis-turquoise-700 hover:underline"
                    >
                      {resourceTypeLabel(log.resourceType)}
                    </Link>
                  ) : (
                    <span className="text-slate-600">
                      {resourceTypeLabel(log.resourceType)}
                    </span>
                  )}
                </Td>
                <Td className="max-w-md">
                  <p className="text-slate-700">{log.metadata || "—"}</p>
                  {(log.ip || log.userAgent) && (
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {[log.ip, log.userAgent].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
        <span>
          {data.total} entrée{data.total > 1 ? "s" : ""} — page {data.page + 1}{" "}
          sur {data.pageCount}
        </span>
        <div className="flex gap-3">
          {data.page > 0 ? (
            <Link
              href={pageHref(baseParams, data.page - 1)}
              className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100"
            >
              Précédent
            </Link>
          ) : (
            <span className="rounded-md border border-slate-200 px-3 py-1 text-slate-300">
              Précédent
            </span>
          )}
          {data.page < data.pageCount - 1 ? (
            <Link
              href={pageHref(baseParams, data.page + 1)}
              className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100"
            >
              Suivant
            </Link>
          ) : (
            <span className="rounded-md border border-slate-200 px-3 py-1 text-slate-300">
              Suivant
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
