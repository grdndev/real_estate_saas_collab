import { z } from "zod";

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
  "RESERVATION_SIGNED",
  "CONTRACT_SIGNED",
  "SENT_TO_NOTARY",
  "NOTARY_ACT_PENDING",
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
  lotId: z.string().min(1),
  clientId: z.string().min(1),
});
export type AssignClientInput = z.infer<typeof assignClientSchema>;

// La dissociation se pilote depuis le lot : elle retire `Lot.dossierId`.
export const unassignClientSchema = z.object({
  lotId: z.string().min(1),
});
export type UnassignClientInput = z.infer<typeof unassignClientSchema>;

export const assignCollaboratorSchema = z.object({
  dossierId: z.string().min(1),
  collaboratorId: z.string().min(1),
  role: z.enum(["COLLABORATOR_PRIMARY", "COLLABORATOR_SECONDARY"]),
});
export type AssignCollaboratorInput = z.infer<typeof assignCollaboratorSchema>;

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const createClientAndDossierSchema = z
  .object({
    // Seuls le nom et le prénom sont obligatoires (T11). L'email n'est requis
    // que pour un client disposant d'un accès à la plateforme.
    firstName: z.string().min(1, "Prénom requis").max(60).trim(),
    lastName: z.string().min(1, "Nom requis").max(60).trim(),
    email: z
      .union([z.email("Email invalide").toLowerCase(), z.literal("")])
      .optional(),
    /**
     * « Client associé » sans accès à la plateforme (T7) : ni connexion, ni
     * invitation, ni email de relance. L'email devient facultatif.
     */
    noAccount: z.boolean(),
    phone: z
      .string()
      .regex(/^[0-9 +().-]*$/, "Format invalide")
      .max(30)
      .optional()
      .or(z.literal("")),
    programmeId: z.string().min(1, "Programme requis"),
    // Un dossier porte toujours un lot : il matérialise l'achat de CE lot.
    lotId: z.string().min(1, "Lot requis"),
    initialNote: z.string().max(500).optional(),
    // Fiche client étendue — tous optionnels à la création.
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
  })
  // Un client avec accès a forcément une adresse email : c'est son identifiant
  // de connexion. Un client sans compte peut s'en passer.
  .refine((v) => v.noAccount || Boolean(v.email), {
    message: "Email requis pour un client disposant d'un accès à la plateforme",
    path: ["email"],
  });
export type CreateClientAndDossierInput = z.infer<
  typeof createClientAndDossierSchema
>;

export const relaunchClientSchema = z.object({
  dossierId: z.string().min(1),
  comment: z.string().max(500).optional(),
});
export type RelaunchClientInput = z.infer<typeof relaunchClientSchema>;
