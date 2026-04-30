import type { Job } from "pg-boss";
import { prisma } from "@/lib/prisma";
import { readObject } from "@/lib/storage/s3";
import { scanBuffer } from "@/lib/storage/clamav";
import { audit } from "@/lib/audit";
import {
  SCAN_DOCUMENT_QUEUE,
  type ScanDocumentJob,
  getQueue,
} from "@/lib/queue";

let started = false;

/** Démarre les workers pg-boss. Appelé une seule fois par process. */
export async function startWorkers(): Promise<void> {
  if (started) return;
  started = true;

  const boss = await getQueue();
  await boss.work<ScanDocumentJob>(
    SCAN_DOCUMENT_QUEUE,
    { batchSize: 2, pollingIntervalSeconds: 2 },
    async (jobs) => {
      for (const job of jobs) {
        await handleScanJob(job);
      }
    },
  );

  console.info(`[pg-boss] worker démarré : queue "${SCAN_DOCUMENT_QUEUE}"`);
}

async function handleScanJob(job: Job<ScanDocumentJob>): Promise<void> {
  const { documentId } = job.data;
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });
  if (!document) {
    return; // doc supprimé entre-temps — rien à faire
  }
  if (document.scanStatus === "CLEAN" || document.scanStatus === "INFECTED") {
    return; // déjà scanné
  }

  try {
    const buffer = await readObject(document.storageKey);
    const result = await scanBuffer(buffer);
    const newStatus =
      result.verdict === "CLEAN"
        ? "CLEAN"
        : result.verdict === "INFECTED"
          ? "INFECTED"
          : "ERROR";

    await prisma.document.update({
      where: { id: documentId },
      data: { scanStatus: newStatus, scanCheckedAt: new Date() },
    });

    if (newStatus !== "CLEAN") {
      await audit({
        action: "DOCUMENT_DELETED",
        resourceType: "Document",
        resourceId: documentId,
        metadata: {
          step: "scan_failed",
          verdict: result.verdict,
          signature: result.signature,
        },
      });
    }
  } catch (err) {
    console.error(`[scan-worker] échec doc=${documentId}`, err);
    await prisma.document.update({
      where: { id: documentId },
      data: { scanStatus: "ERROR", scanCheckedAt: new Date() },
    });
    throw err; // pg-boss retentera selon retryLimit
  }
}
