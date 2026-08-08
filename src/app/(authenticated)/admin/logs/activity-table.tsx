"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import {
  InfiniteSentinel,
  useInfiniteRows,
} from "@/components/ui/infinite-rows";
import { loadMoreActivityAction } from "@/lib/admin/activity-actions";
import type { ActivityLogEntry } from "@/lib/admin/activity";
import {
  actionBadge,
  actionLabel,
  resourceTypeLabel,
} from "@/lib/admin/activity-labels";

/**
 * Journal d'activité à chargement progressif (T16).
 *
 * La première tranche vient du serveur ; les suivantes sont demandées au
 * scroll avec le curseur renvoyé par la précédente. Un changement de filtre
 * remonte la liste à zéro via l'attribut `key` posé par la page.
 */
interface ActivityTableProps {
  initialLogs: ActivityLogEntry[];
  /** Curseur issu de la première tranche, `null` s'il n'y a rien de plus. */
  initialCursor: string | null;
  /** Nombre total d'entrées du périmètre, compté à la première tranche. */
  total: number | null;
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

export function ActivityTable({
  initialLogs,
  initialCursor,
  total,
}: ActivityTableProps) {
  // Le périmètre est relu depuis l'URL : même source que la première tranche.
  const query = useSearchParams().toString();
  const loadPage = useCallback(
    async (cursor: string | null) => {
      const result = await loadMoreActivityAction(query, cursor);
      if (!result.ok) return result;
      return {
        ok: true as const,
        value: {
          rows: result.value.logs,
          nextCursor: result.value.nextCursor,
        },
      };
    },
    [query],
  );

  const { rows, loading, done, error, setSentinel, retry } =
    useInfiniteRows<ActivityLogEntry>({
      initialRows: initialLogs,
      initialCursor,
      loadPage,
    });

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Aucune activité"
        description="Aucune entrée ne correspond aux critères sélectionnés."
      />
    );
  }

  return (
    <div>
      {total !== null && (
        <p className="border-b border-slate-100 px-4 py-2 text-sm text-slate-600">
          {total} entrée{total > 1 ? "s" : ""} au total.
        </p>
      )}
      {/* Pas de scroll vertical interne : la sentinelle est rendue sous le
          tableau et doit rester pilotée par le scroll de la page. */}
      <Table scrollY={false}>
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
          {rows.map((log) => {
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
      <InfiniteSentinel
        loading={loading}
        done={done}
        error={error}
        setSentinel={setSentinel}
        retry={retry}
        loadedCount={rows.length}
        itemLabel="entrée"
      />
    </div>
  );
}
