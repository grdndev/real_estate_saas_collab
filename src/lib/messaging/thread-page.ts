import { prisma } from "@/lib/prisma";
import type { MessageRow } from "@/components/messaging/thread";

/**
 * Fil de discussion découpé par curseur `createdAt|id` (T16).
 *
 * Le fil se lit du plus récent vers le plus ancien : la première tranche est
 * la fin de la conversation, les suivantes remontent le temps et sont ajoutées
 * en tête. Auparavant le fil était coupé net aux 200 derniers messages, les
 * plus anciens restant inaccessibles.
 *
 * La clé (createdAt, id) donne un ordre total : un message envoyé pendant la
 * lecture ne peut ni décaler ni dupliquer une tranche.
 */

/** Nombre de messages par tranche. */
export const THREAD_CHUNK_SIZE = 100;

export interface ThreadPage {
  /** Messages de la tranche, du plus ancien au plus récent (ordre d'affichage). */
  rows: MessageRow[];
  /** Curseur de la tranche plus ancienne, `null` s'il n'y a plus rien. */
  nextCursor: string | null;
}

function encodeCursor(row: { createdAt: Date; id: string }): string {
  return `${row.createdAt.toISOString()}|${row.id}`;
}

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
 * Tranche de messages d'un dossier, strictement plus ancienne que le curseur.
 * `cursor` à `null` renvoie la fin de la conversation.
 *
 * L'appelant est responsable du contrôle d'accès au dossier.
 */
export async function loadThreadPage(
  dossierId: string,
  cursor: string | null,
): Promise<ThreadPage> {
  const decoded = decodeCursor(cursor);

  const rows = await prisma.message.findMany({
    where: {
      dossierId,
      // Strictement avant le curseur : date antérieure, ou même date et id
      // plus petit.
      ...(decoded
        ? {
            OR: [
              { createdAt: { lt: decoded.createdAt } },
              { createdAt: decoded.createdAt, id: { lt: decoded.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    // Une ligne de plus que la tranche : sa présence indique qu'il reste des
    // messages plus anciens.
    take: THREAD_CHUNK_SIZE + 1,
    include: { sender: { select: { firstName: true, lastName: true } } },
  });

  const hasMore = rows.length > THREAD_CHUNK_SIZE;
  const slice = hasMore ? rows.slice(0, THREAD_CHUNK_SIZE) : rows;
  const oldest = slice[slice.length - 1];

  return {
    // Ordre d'affichage : du plus ancien au plus récent.
    rows: slice.reverse().map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt,
      senderId: m.senderId,
      senderName: `${m.sender.firstName} ${m.sender.lastName}`,
      sentByEmail: m.sentByEmail,
      emailAttachmentCount: m.emailAttachmentCount,
      readByOthers: m.readBy.length > 0,
    })),
    nextCursor: hasMore && oldest ? encodeCursor(oldest) : null,
  };
}
