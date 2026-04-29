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

export async function getSettings(): Promise<PlatformSettings> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.keys(DEFAULTS) } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
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
}
