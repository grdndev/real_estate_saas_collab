import { z } from "zod";

import { DEFAULT_VAT_RATE } from "./excel-import";

export const treasuryEntrySchema = z.object({
  programmeId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Format YYYY-MM"),
  income: z.number().min(0).max(999_999_999),
  expense: z.number().min(0).max(999_999_999),
});
export type TreasuryEntryInput = z.infer<typeof treasuryEntrySchema>;

// Import d'un programme + lots via fichier Excel (glisser-déposer).
export const importProgrammeSchema = z.object({
  name: z.string().min(2, "Nom du programme trop court").max(120).trim(),
  reference: z
    .string()
    .min(2, "Référence trop courte")
    .max(40, "Référence trop longue")
    .regex(/^[A-Z0-9_-]+$/i, "Caractères alphanumériques, tiret ou underscore"),
  city: z.string().max(80).optional().or(z.literal("")),
  // TVA par défaut (%) appliquée aux lignes sans colonne TVA et pour la
  // conversion TTC → HT.
  vatRate: z.number().min(0).max(100).default(DEFAULT_VAT_RATE),
  // Fichier Excel encodé en base64.
  fileB64: z
    .string()
    .min(1, "Fichier requis")
    .max(8_000_000, "Fichier trop volumineux"),
});
export type ImportProgrammeInput = z.infer<typeof importProgrammeSchema>;
