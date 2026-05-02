/**
 * Next.js 16 — instrumentation.ts
 * Exécuté une seule fois au démarrage du serveur (Node runtime).
 * Démarre les workers pg-boss en arrière-plan.
 */
export async function register() {
  // Skip pendant le build (DATABASE_URL pointe vers une base factice).
  if (process.env.SKIP_ENV_VALIDATION === "1") return;
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { startWorkers } = await import("@/lib/queue/scan-worker");
    await startWorkers();
  } catch (err) {
    console.error(
      "[instrumentation] Impossible de démarrer les workers scan :",
      err instanceof Error ? err.message : err,
    );
  }

  try {
    const { startRelaunchScheduler } =
      await import("@/lib/queue/relaunch-worker");
    await startRelaunchScheduler();
  } catch (err) {
    console.error(
      "[instrumentation] Impossible de démarrer le scheduler relance :",
      err instanceof Error ? err.message : err,
    );
  }
}
