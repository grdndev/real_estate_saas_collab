import { prisma } from "@/lib/prisma";

/**
 * Pagination par curseur des notifications lues (T14).
 *
 * L'ordre est `createdAt desc, id desc` : la clé composite donne un ordre total,
 * donc un curseur stable même si plusieurs notifications partagent la même
 * milliseconde. Aucune ligne ne peut être dupliquée ni sautée d'une page à
 * l'autre, contrairement à un `skip` numérique.
 */

export const NOTIFICATIONS_PAGE_SIZE = 30;

export interface NotificationRowData {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: Date;
}

/** Encode le curseur d'une notification. */
function encodeCursor(row: { createdAt: Date; id: string }): string {
  return `${row.createdAt.toISOString()}|${row.id}`;
}

/** Décode un curseur, `null` s'il est absent ou malformé. */
function decodeCursor(
  cursor: string | null,
): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  const separator = cursor.lastIndexOf("|");
  if (separator === -1) return null;
  const createdAt = new Date(cursor.slice(0, separator));
  const id = cursor.slice(separator + 1);
  if (Number.isNaN(createdAt.getTime()) || !id) return null;
  return { createdAt, id };
}

/**
 * Page de notifications lues d'un utilisateur.
 * `cursor` à `null` renvoie la première page.
 */
export async function loadReadNotificationsPage(
  userId: string,
  cursor: string | null,
): Promise<{ rows: NotificationRowData[]; nextCursor: string | null }> {
  const decoded = decodeCursor(cursor);

  const rows = await prisma.notification.findMany({
    where: {
      userId,
      readAt: { not: null },
      // Strictement « après » le curseur dans l'ordre décroissant : soit une
      // date antérieure, soit la même date et un id plus petit.
      ...(decoded
        ? {
            OR: [
              { createdAt: { lt: decoded.createdAt } },
              {
                createdAt: decoded.createdAt,
                id: { lt: decoded.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    // Une ligne de plus que la page : sa présence indique qu'il reste à charger.
    take: NOTIFICATIONS_PAGE_SIZE + 1,
    select: {
      id: true,
      kind: true,
      title: true,
      body: true,
      link: true,
      createdAt: true,
    },
  });

  const hasMore = rows.length > NOTIFICATIONS_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, NOTIFICATIONS_PAGE_SIZE) : rows;
  const last = page[page.length - 1];

  return {
    rows: page,
    nextCursor: hasMore && last ? encodeCursor(last) : null,
  };
}
