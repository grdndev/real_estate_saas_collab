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

export const dossierFiltersSchema = z.object({
  status: dossierStatusEnum.optional(),
  programmeId: z.string().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export type DossierFiltersInput = z.infer<typeof dossierFiltersSchema>;
