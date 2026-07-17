import { z } from "zod";

export const prospectStatusEnum = z.enum([
  "NEW",
  "QUALIFIED",
  "OPTIONED",
  "CONVERTED",
  "DROPPED",
]);
export type ProspectStatusInput = z.infer<typeof prospectStatusEnum>;

export const createProspectSchema = z.object({
  firstName: z.string().min(2, "Prénom trop court").max(60).trim(),
  lastName: z.string().min(2, "Nom trop court").max(60).trim(),
  email: z.email("Email invalide").toLowerCase(),
  phone: z
    .string()
    .min(8, "Numéro trop court")
    .regex(/^[0-9 +().-]+$/, "Format invalide")
    .optional()
    .or(z.literal("")),
  city: z.string().max(80).optional().or(z.literal("")),
  programmeId: z.string().optional().nullable(),
  source: z.string().max(80).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});
export type CreateProspectInput = z.infer<typeof createProspectSchema>;

export const updateProspectStatusSchema = z.object({
  prospectId: z.string().min(1),
  status: prospectStatusEnum,
});
export type UpdateProspectStatusInput = z.infer<
  typeof updateProspectStatusSchema
>;

export const importProspectsSchema = z.object({
  csv: z.string().min(1, "CSV requis").max(2_000_000, "CSV trop volumineux"),
  programmeId: z.string().optional().nullable(),
  source: z.string().max(80).optional(),
});
export type ImportProspectsInput = z.infer<typeof importProspectsSchema>;

export const convertProspectSchema = z.object({
  prospectId: z.string().min(1),
  programmeId: z.string().min(1, "Programme requis"),
  lotId: z.string().optional().nullable(),
});
export type ConvertProspectInput = z.infer<typeof convertProspectSchema>;

export const revertProspectConversionSchema = z.object({
  prospectId: z.string().min(1),
});
export type RevertProspectConversionInput = z.infer<
  typeof revertProspectConversionSchema
>;
