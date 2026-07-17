import { z } from "zod";

export const familyStatusEnum = z.enum([
  "SINGLE",
  "MARRIED",
  "PACS",
  "DIVORCED",
  "WIDOWED",
  "COHABITING",
]);

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const upsertClientProfileSchema = z.object({
  dossierId: z.string().min(1),
  // Identité (modèle User)
  firstName: z.string().trim().min(1, "Prénom requis").max(60),
  lastName: z.string().trim().min(1, "Nom requis").max(60),
  phone: optionalText(30),
  // Fiche client étendue (modèle ClientProfile)
  birthName: optionalText(80),
  birthDate: optionalText(10),
  birthPlace: optionalText(120),
  profession: optionalText(120),
  nationality: optionalText(80),
  addressLine: optionalText(200),
  postalCode: optionalText(10),
  city: optionalText(80),
  country: optionalText(60),
  familyStatus: z.string().optional(),
  marriageDate: optionalText(10),
  marriagePlace: optionalText(120),
  marriageContract: optionalText(200),
});
export type UpsertClientProfileInput = z.infer<
  typeof upsertClientProfileSchema
>;

export const FAMILY_STATUS_LABEL: Record<
  z.infer<typeof familyStatusEnum>,
  string
> = {
  SINGLE: "Célibataire",
  MARRIED: "Marié(e)",
  PACS: "Pacsé(e)",
  DIVORCED: "Divorcé(e)",
  WIDOWED: "Veuf / Veuve",
  COHABITING: "Concubinage",
};
