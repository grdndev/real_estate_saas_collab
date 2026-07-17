import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export interface PlatformSettings {
  RELAUNCH_DELAY_DAYS: number;
  SESSION_INACTIVITY_MINUTES: number;
  AUTO_EMAILS_ENABLED: boolean;
}

const DEFAULTS: PlatformSettings = {
  RELAUNCH_DELAY_DAYS: 7,
  SESSION_INACTIVITY_MINUTES: env.SESSION_INACTIVITY_MINUTES,
  AUTO_EMAILS_ENABLED: true,
};

// Cache mémoire : getSettings est appelé à chaque requête (callback jwt,
// via proxy.ts) — sans cache, une requête DB par hit.
let cache: { value: PlatformSettings; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

export function invalidateSettingsCache(): void {
  cache = null;
}

// Logo société (data URL) : cache dédié, séparé de PlatformSettings pour ne
// pas alourdir getSettings() (appelé à chaque requête via le callback jwt).
const COMPANY_LOGO_KEY = "COMPANY_LOGO";
let logoCache: { value: string | null; expiresAt: number } | null = null;

export function invalidateCompanyLogoCache(): void {
  logoCache = null;
}

/** Logo de la société en data URL (base64), ou null si aucun logo défini. */
export async function getCompanyLogo(): Promise<string | null> {
  if (logoCache && Date.now() < logoCache.expiresAt) return logoCache.value;
  const row = await prisma.setting.findUnique({
    where: { key: COMPANY_LOGO_KEY },
  });
  const value = row?.value || null;
  logoCache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export async function getSettings(): Promise<PlatformSettings> {
  if (cache && Date.now() < cache.expiresAt) return cache.value;
  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.keys(DEFAULTS) } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const value: PlatformSettings = {
    RELAUNCH_DELAY_DAYS: parseInt(
      map.get("RELAUNCH_DELAY_DAYS") ?? String(DEFAULTS.RELAUNCH_DELAY_DAYS),
      10,
    ),
    SESSION_INACTIVITY_MINUTES: parseInt(
      map.get("SESSION_INACTIVITY_MINUTES") ??
        String(DEFAULTS.SESSION_INACTIVITY_MINUTES),
      10,
    ),
    AUTO_EMAILS_ENABLED:
      (map.get("AUTO_EMAILS_ENABLED") ??
        String(DEFAULTS.AUTO_EMAILS_ENABLED)) === "true",
  };
  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}
