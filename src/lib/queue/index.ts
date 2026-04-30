import { PgBoss } from "pg-boss";
import { env } from "@/lib/env";

export const SCAN_DOCUMENT_QUEUE = "scan-document";

export interface ScanDocumentJob {
  documentId: string;
}

let bossPromise: Promise<PgBoss> | null = null;

/**
 * Singleton pg-boss. Lazy-init au premier accès.
 * Pour le démarrage des workers, voir `src/instrumentation.ts`.
 */
export function getQueue(): Promise<PgBoss> {
  if (bossPromise) return bossPromise;

  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    // Rétention par défaut (7j) — voir QueueOptions.deleteAfterSeconds
    // si on veut affiner par queue.
  });
  boss.on("error", (err: Error) => {
    console.error("[pg-boss] error", err);
  });
  const promise = boss
    .start()
    .then(async () => {
      // Crée la queue si elle n'existe pas — idempotent.
      await boss.createQueue(SCAN_DOCUMENT_QUEUE);
      return boss;
    })
    .catch((err: unknown) => {
      bossPromise = null;
      throw err;
    });
  bossPromise = promise;
  return promise;
}

export async function enqueueScan(documentId: string): Promise<void> {
  const boss = await getQueue();
  await boss.send(
    SCAN_DOCUMENT_QUEUE,
    { documentId } satisfies ScanDocumentJob,
    {
      retryLimit: 3,
      retryBackoff: true,
      expireInSeconds: 3600,
    },
  );
}
