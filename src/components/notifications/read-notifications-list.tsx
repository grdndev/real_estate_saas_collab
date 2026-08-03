"use client";

import { NotificationRow } from "@/components/notifications/notification-row";
import { Card } from "@/components/ui/card";
import {
  InfiniteSentinel,
  useInfiniteRows,
} from "@/components/ui/infinite-rows";
import { loadMoreNotificationsAction } from "@/lib/notifications/actions";
import type { NotificationRowData } from "@/lib/notifications/list";

/**
 * Notifications déjà lues, chargées progressivement au scroll (T14).
 *
 * Les non-lues restent rendues intégralement par le serveur : leur nombre est
 * borné en pratique et le compteur affiché doit rester exact.
 */
interface Props {
  initialRows: NotificationRowData[];
  initialCursor: string | null;
  kindLabels: Record<string, string>;
}

export function ReadNotificationsList({
  initialRows,
  initialCursor,
  kindLabels,
}: Props) {
  const { rows, loading, done, error, setSentinel, retry } =
    useInfiniteRows<NotificationRowData>({
      initialRows,
      initialCursor,
      loadPage: loadMoreNotificationsAction,
    });

  if (rows.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold tracking-widest text-slate-500 uppercase">
        Plus anciennes
      </h2>
      <Card>
        <ul className="divide-y divide-slate-100">
          {rows.map((n) => (
            <NotificationRow
              key={n.id}
              id={n.id}
              title={n.title}
              body={n.body}
              link={n.link}
              read
              createdAt={n.createdAt}
              kind={n.kind}
              kindLabel={kindLabels[n.kind] ?? n.kind}
            />
          ))}
        </ul>
      </Card>
      <InfiniteSentinel
        loading={loading}
        done={done}
        error={error}
        setSentinel={setSentinel}
        retry={retry}
        loadedCount={rows.length}
        itemLabel="notification"
      />
    </section>
  );
}
