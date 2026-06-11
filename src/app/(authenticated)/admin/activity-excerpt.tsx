"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type JsonValue } from "@prisma/client/runtime/client";

type events = {
  user: {
    firstName: string;
    lastName: string;
  } | null;
} & {
  id: string;
  action: string;
  createdAt: Date;
  resourceType: string;
  resourceId: string | null;
  metadata: JsonValue;
  ip: string | null;
  userAgent: string | null;
  userId: string | null;
};

export default function ActivityExcerpt({
  recentEvents,
}: {
  recentEvents: events[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activité récente</CardTitle>
      </CardHeader>
      <CardContent>
        {recentEvents.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucune activité enregistrée pour le moment.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentEvents.map((event) => (
              <li
                key={event.id}
                className="grid grid-cols-3 items-center justify-between gap-4 py-3 text-sm"
              >
                <span className="text-equatis-night-800 font-mono text-xs">
                  {event.action}
                </span>
                <span className="text-slate-600">
                  {event.user
                    ? `${event.user.firstName} ${event.user.lastName}`
                    : "système"}
                </span>
                <span className="text-right text-xs text-slate-500">
                  {event.createdAt.toLocaleString("fr-FR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
