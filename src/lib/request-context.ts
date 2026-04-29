import { headers } from "next/headers";

/** Récupère IP + UA depuis les headers de la requête (CDC §3.4 — journalisation). */
export async function getRequestContext(): Promise<{
  ip: string | null;
  userAgent: string | null;
}> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;
  const userAgent = h.get("user-agent");
  return { ip, userAgent };
}
