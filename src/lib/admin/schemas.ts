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
  reference: z
    .string()
    .min(2, "Référence trop courte")
    .max(40, "Référence trop longue")
    .regex(/^[A-Z0-9_-]+$/i, "Caractères alphanumériques, tiret ou underscore"),
  name: z.string().min(2, "Nom trop court").max(120),
  description: z.string().max(2000).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
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

export const lotSchema = z.object({
  programmeId: z.string().min(1),
  reference: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Z0-9_-]+$/i, "Caractères alphanumériques uniquement"),
  surface: z.number().positive("Surface > 0").max(100_000),
  floor: z.number().int().min(-5).max(50).optional().nullable(),
  type: z.string().min(1).max(20),
  priceHT: z.number().positive("Prix > 0").max(99_999_999),
  vatRate: z.number().min(0).max(50),
  status: z.enum(["AVAILABLE", "RESERVED", "SOLD", "WITHDRAWN"]),
});
export type LotInput = z.infer<typeof lotSchema>;

export const updateLotSchema = lotSchema.extend({
  id: z.string().min(1),
});
export type UpdateLotInput = z.infer<typeof updateLotSchema>;

export const settingsSchema = z.object({
  RELAUNCH_DELAY_DAYS: z.number().int().min(1).max(90),
  SESSION_INACTIVITY_MINUTES: z.number().int().min(5).max(240),
  AUTO_EMAILS_ENABLED: z.boolean(),
});
export type SettingsInput = z.infer<typeof settingsSchema>;
