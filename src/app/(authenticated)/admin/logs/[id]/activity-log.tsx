"use client";

import { useState } from "react";

type fetchLogs = {
  id: string;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}[];

export default function ActivityLog({ logs }: { logs: fetchLogs }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(logs.length / 100);
  const currentLogs = logs.slice(page * 100, (page + 1) * 100);

  return (
    <div className="rounded-md bg-white p-4 shadow">
      {logs.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucune activité enregistrée pour le moment.
        </p>
      ) : (
        <ul className="h-100 divide-y divide-slate-100 overflow-y-auto">
          {currentLogs.map((event, index) => (
            <li
              key={index}
              className="grid w-full grid-cols-4 items-center justify-between gap-4 text-sm"
            >
              <span className="text-equatis-night-800 font-mono text-xs">
                {event.action}
              </span>
              <span className="text-xs text-slate-500">
                {event.createdAt.toLocaleString("fr-FR")}
              </span>
              <span className="text-slate-600">{event.metadata || "—"}</span>
              <span className="text-right text-xs text-slate-600">
                {event.userAgent || "N/A"} - {event.ip || "N/A"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex items-center justify-end gap-5">
        <div className="text-sm text-slate-500">
          Page {page + 1} sur {totalPages}
        </div>
        <button
          className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-50"
          onClick={() => setPage((p) => Math.max(p - 1, 0))}
          disabled={page === 0}
        >
          Précédent
        </button>
        <button
          className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-50"
          onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
          disabled={page >= totalPages - 1}
        >
          Suivant
        </button>
      </div>
    </div>
  );
}
