import { z } from "zod";

export const createDossierSchema = z.object({
  programmeId: z.string().min(1, "Programme requis"),
  lotId: z.string().min(1).optional().nullable(),
  clientId: z.string().min(1).optional().nullable(),
  collaboratorId: z.string().min(1, "Collaborateur référent requis"),
  initialNote: z.string().max(500).optional(),
});
export type CreateDossierInput = z.infer<typeof createDossierSchema>;

export const dossierStatusEnum = z.enum([
  "NEW_LEAD",
  "RESERVATION_SENT",
  "SIGNATURE_PENDING",
  "SIGNED_AT_NOTARY",
  "LOAN_OFFER_RECEIVED",
  "ACT_SIGNED",
  "BLOCKED",
]);

export const updateDossierStatusSchema = z.object({
  dossierId: z.string().min(1),
  status: dossierStatusEnum,
  comment: z.string().max(500).optional(),
});
export type UpdateDossierStatusInput = z.infer<
  typeof updateDossierStatusSchema
>;

export const contractStatusEnum = z.enum([
  "AWAITING_SIGNATURE",
  "CONTRACT_SIGNED",
  "SENT_TO_NOTARY",
  "LOAN_OFFER_PENDING",
  "LOAN_OFFER_RECEIVED",
  "LOAN_OFFER_SENT_TO_NOTARY",
  "NOTARY_APPOINTMENT_SCHEDULED",
]);

export const updateContractStatusSchema = z.object({
  dossierId: z.string().min(1),
  contractStatus: contractStatusEnum,
  comment: z.string().max(500).optional(),
});
export type UpdateContractStatusInput = z.infer<
  typeof updateContractStatusSchema
>;

export const setDossierOptionSchema = z.object({
  dossierId: z.string().min(1),
  optioned: z.boolean(),
  // Délai de l'option en mois (ex. 3 mois). Ignoré si optioned = false.
  optionDelayMonths: z.coerce.number().int().min(1).max(24).default(3),
});
export type SetDossierOptionInput = z.infer<typeof setDossierOptionSchema>;

export const assignClientSchema = z.object({
  dossierId: z.string().min(1),
  clientId: z.string().min(1),
});
export type AssignClientInput = z.infer<typeof assignClientSchema>;

export const assignCollaboratorSchema = z.object({
  dossierId: z.string().min(1),
  collaboratorId: z.string().min(1),
  role: z.enum(["COLLABORATOR_PRIMARY", "COLLABORATOR_SECONDARY"]),
});
export type AssignCollaboratorInput = z.infer<typeof assignCollaboratorSchema>;

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const createClientAndDossierSchema = z.object({
  firstName: z.string().min(2, "Prénom trop court").max(60).trim(),
  lastName: z.string().min(2, "Nom trop court").max(60).trim(),
  email: z.email("Email invalide").toLowerCase(),
  phone: z
    .string()
    .min(8, "Numéro trop court")
    .regex(/^[0-9 +().-]+$/, "Format invalide")
    .optional()
    .or(z.literal("")),
  programmeId: z.string().min(1, "Programme requis"),
  lotId: z.string().optional().nullable(),
  initialNote: z.string().max(500).optional(),
  // Fiche client étendue — tous optionnels à la création.
  birthName: optionalText(80),
  birthDate: optionalText(10),
  birthPlace: optionalText(120),
  profession: optionalText(120),
  nationality: optionalText(80),
  address: optionalText(300),
  familyStatus: z.string().optional(),
  marriageDate: optionalText(10),
  marriagePlace: optionalText(120),
  marriageContract: optionalText(200),
  // Pièces déposées dès la création (PDF base64, optionnel).
  cniFileB64: z.string().max(8_000_000).optional().or(z.literal("")),
  cniFileName: z.string().max(255).optional().or(z.literal("")),
  marriageContractFileB64: z
    .string()
    .max(8_000_000)
    .optional()
    .or(z.literal("")),
  marriageContractFileName: z.string().max(255).optional().or(z.literal("")),
  // RDV notaire déjà fixé (date/heure ISO, optionnel).
  notaryAppointmentAt: optionalText(40),
});
export type CreateClientAndDossierInput = z.infer<
  typeof createClientAndDossierSchema
>;

export const relaunchClientSchema = z.object({
  dossierId: z.string().min(1),
  comment: z.string().max(500).optional(),
});
export type RelaunchClientInput = z.infer<typeof relaunchClientSchema>;

export const dossierFiltersSchema = z.object({
  status: dossierStatusEnum.optional(),
  programmeId: z.string().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export type DossierFiltersInput = z.infer<typeof dossierFiltersSchema>;
