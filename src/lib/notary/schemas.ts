import { z } from "zod";

// Contraintes email (Brevo) : limite pratique sur les pièces jointes.
export const MAX_NOTARY_ATTACHMENT_FILES = 10;
export const MAX_NOTARY_ATTACHMENT_TOTAL_BYTES = 9 * 1024 * 1024; // ~9 Mo

export const transmitToNotarySchema = z.object({
  dossierId: z.string().min(1),
  notaryId: z.string().min(1, "Notaire requis"),
  comment: z.string().max(500).optional(),
  documentIds: z.array(z.string()).max(MAX_NOTARY_ATTACHMENT_FILES).default([]),
});
export type TransmitToNotaryInput = z.input<typeof transmitToNotarySchema>;

export const flagMissingPieceSchema = z.object({
  dossierId: z.string().min(1),
  label: z.string().min(2).max(120),
});
export type FlagMissingPieceInput = z.infer<typeof flagMissingPieceSchema>;

export const notaryStatusSchema = z.enum(["ACT_SIGNED", "BLOCKED"]);
