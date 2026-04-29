import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Masque un nom : "Marie Dupont" → "●●●●● ●●●●●●". */
export function maskName(name: string): string {
  return name
    .split(" ")
    .map((part) => "●".repeat(Math.max(part.length, 4)))
    .join(" ");
}

/** Référence dossier "EQ-2026-0001". À utiliser via une séquence Postgres en V1.1. */
export function buildDossierReference(year: number, n: number): string {
  return `EQ-${year}-${String(n).padStart(4, "0")}`;
}
