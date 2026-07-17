import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Slug pour noms de fichiers : minuscules, accents retirés, non-alphanumériques → "-". */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Référence dossier "EQ-2026-0001". À utiliser via une séquence Postgres en V1.1. */
export function buildDossierReference(year: number, n: number): string {
  return `EQ-${year}-${String(n).padStart(4, "0")}`;
}
