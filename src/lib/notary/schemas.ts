import { z } from "zod";

export const transmitToNotarySchema = z.object({
  dossierId: z.string().min(1),
  notaryId: z.string().min(1, "Notaire requis"),
  comment: z.string().max(500).optional(),
});
export type TransmitToNotaryInput = z.infer<typeof transmitToNotarySchema>;

export const flagMissingPieceSchema = z.object({
  dossierId: z.string().min(1),
  label: z.string().min(2).max(120),
});
export type FlagMissingPieceInput = z.infer<typeof flagMissingPieceSchema>;

export const notaryStatusSchema = z.enum(["ACT_SIGNED", "BLOCKED"]);
