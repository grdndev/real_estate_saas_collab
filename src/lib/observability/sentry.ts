import { env } from "@/lib/env";

/**
 * Stub Sentry — la lib `@sentry/nextjs` n'est pas installée par défaut.
 * Ce module fournit une API stable pour reporter une erreur, et n'envoie
 * réellement quoi que ce soit que si SENTRY_DSN est configuré ET que la
 * lib est installée.
 *
 * Activation en prod :
 *   1. pnpm add @sentry/nextjs
 *   2. npx @sentry/wizard@latest -i nextjs
 *   3. Renseigner SENTRY_DSN dans .env
 *
 * On utilise un import dynamique vers un specifier construit pour ne pas
 * que webpack/turbopack/tsc tente de résoudre le module absent au build.
 */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (!env.SENTRY_DSN) {
    console.error("[error]", error, context);
    return;
  }
  void Promise.resolve()
    .then(async () => {
      try {
        const specifier = "@sentry/" + "nextjs";
        const mod = (await (
          new Function("s", "return import(s)") as (
            s: string,
          ) => Promise<unknown>
        )(specifier).catch(() => null)) as {
          captureException?: (e: unknown, opts?: unknown) => void;
        } | null;
        mod?.captureException?.(error, { extra: context });
      } catch {
        // ignore
      }
    })
    .catch(() => undefined);
}
