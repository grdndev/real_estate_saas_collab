import { z } from "zod";

import { dossierStatusEnum } from "@/lib/dossier/schemas";

/**
 * Filtres de la liste des lots (`/collaborateur/lots`, `/admin/lots`).
 *
 * La liste est centrée sur le LOT : un lot y figure qu'il porte un dossier ou
 * non. Les filtres `status` (statut commercial) portent donc sur le dossier
 * actif du lot et excluent mécaniquement les lots libres.
 */
export const lotFiltersSchema = z.object({
  /** Statut commercial du dossier actif. */
  status: dossierStatusEnum.optional(),
  /** Statut du lot lui-même (disponible, réservé, vendu…). */
  lotStatus: z
    .enum(["AVAILABLE", "OPTIONED", "RESERVED", "SOLD", "WITHDRAWN"])
    .optional(),
  programmeId: z.string().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
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
