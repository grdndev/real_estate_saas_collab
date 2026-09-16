import { z } from "zod";

import { contractStatusEnum } from "@/lib/dossier/schemas";

/**
 * Filtres de la liste des lots (`/collaborateur/lots`, `/admin/lots`).
 *
 * La liste est centrée sur le LOT : un lot y figure qu'il porte un dossier ou
 * non. Chaque filtre porte sur le champ que sa colonne affiche.
 */
export const lotFiltersSchema = z.object({
  /** Statut contractuel : contrat du dossier actif. Exclut les lots libres. */
  contractStatus: contractStatusEnum.optional(),
  /** Statut commercial : statut du lot lui-même. */
  lotStatus: z
    .enum(["AVAILABLE", "OPTIONED", "RESERVED", "SOLD", "WITHDRAWN"])
    .optional(),
  programmeId: z.string().optional(),
  search: z.string().max(100).optional(),
  /** N'afficher que les lots ayant un client associé. */
  associes: z
    .union([z.literal("1"), z.literal("0")])
    .optional()
    .transform((v) => v === "1"),
  // Sens du tri naturel sur la référence de lot (T13), croissant par défaut.
  tri: z
    .union([z.literal("asc"), z.literal("desc")])
    .optional()
    .transform((v) => v ?? "asc"),
});
export type LotFiltersInput = z.infer<typeof lotFiltersSchema>;
