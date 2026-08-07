import { z } from "zod";

export const inviteUserSchema = z.object({
  email: z.email("Email invalide").toLowerCase(),
  firstName: z.string().min(2, "Prénom trop court").max(60),
  lastName: z.string().min(2, "Nom trop court").max(60),
  role: z.enum(["COLLABORATOR", "PROMOTER", "NOTARY", "SUPER_ADMIN"], {
    error: () => ({ message: "Rôle invalide" }),
  }),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const userIdSchema = z.object({
  userId: z.string().min(1),
});

export const createProgrammeSchema = z.object({
  name: z.string().min(2, "Nom trop court").max(120),
  description: z.string().max(2000).optional().nullable(),
  zipcode: z.string().max(10).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  caObjective: z.number().min(0).max(999_999_999).optional().nullable(),
});
export type CreateProgrammeInput = z.infer<typeof createProgrammeSchema>;

export const updateProgrammeSchema = createProgrammeSchema.extend({
  id: z.string().min(1),
});
export type UpdateProgrammeInput = z.infer<typeof updateProgrammeSchema>;

export const assignPromoterSchema = z.object({
  programmeId: z.string().min(1),
  promoterId: z.string().min(1),
});

/** Montant € facultatif — champs financiers issus du fichier de suivi. */
const optionalAmount = z.number().min(0).max(99_999_999).optional().nullable();

export const lotSchema = z.object({
  programmeId: z.string().min(1),
  reference: z.string().min(1).max(20),
  surface: z.number().positive("Surface > 0").max(100_000),
  // Surfaces complémentaires, facultatives (T6).
  annexSurface: z.number().min(0).max(100_000).optional().nullable(),
  suv: z.number().min(0).max(100_000).optional().nullable(),
  garden: z.number().min(0).max(100_000).optional().nullable(),
  floor: z.number().int().min(-5).max(50).optional().nullable(),
  type: z.string().min(1).max(20),
  building: z.string().max(60).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  // Les trois montants sont toujours saisis explicitement : aucun n'est
  // recalculé à partir des deux autres (décision produit). Le prix FAI est la
  // valeur du fichier de suivi, le HT et la TVA restent des données propres.
  priceHT: z.number().positive("Prix > 0").max(99_999_999),
  vatRate: z.number().min(0).max(50),
  priceTTC: z.number().positive("Prix > 0").max(99_999_999),
  // Champs financiers additionnels (tracking import).
  priceNetVendeur: optionalAmount,
  priceNetVendeurWithParking: optionalAmount,
  commissionAgence: optionalAmount,
  commissionAgenceParking: optionalAmount,
  priceLocation: optionalAmount,
  creditImpot35: optionalAmount,
  priceRevientCrdImp: optionalAmount,
  additionalParking: z.boolean().optional().nullable(),
  status: z.enum(["AVAILABLE", "OPTIONED", "RESERVED", "SOLD", "WITHDRAWN"]),
});
export type LotInput = z.infer<typeof lotSchema>;

/**
 * Édition d'un lot existant. `status` est volontairement omis : il est piloté
 * par le cycle de vie du dossier (réservation, notaire, acte signé) et une
 * saisie manuelle le désynchroniserait.
 */
export const updateLotSchema = lotSchema.omit({ status: true }).extend({
  id: z.string().min(1),
});
export type UpdateLotInput = z.infer<typeof updateLotSchema>;

export const settingsSchema = z.object({
  RELAUNCH_DELAY_DAYS: z.number().int().min(1).max(90),
  SESSION_INACTIVITY_MINUTES: z.number().int().min(5).max(240),
  AUTO_EMAILS_ENABLED: z.boolean(),
  // Logo société en data URL (≈ 500 Ko de fichier → ~700 Ko de chaîne).
  // Vide/null = suppression du logo (retour à l'en-tête texte).
  COMPANY_LOGO: z
    .string()
    .regex(
      /^data:image\/(png|jpeg);base64,/,
      "Format d'image invalide (PNG ou JPEG)",
    )
    .max(700_000, "Image trop lourde (500 Ko max)")
    .optional()
    .nullable(),
});
export type SettingsInput = z.infer<typeof settingsSchema>;
