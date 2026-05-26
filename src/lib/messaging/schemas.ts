import { z } from "zod";

export const sendDirectMessageSchema = z
  .object({
    recipientId: z.string().min(1, "Destinataire requis"),
    body: z
      .string()
      .trim()
      .max(4000, "Message trop long")
      .optional()
      .or(z.literal("")),
    attachmentB64: z
      .string()
      .max(8_000_000, "Fichier trop volumineux")
      .optional()
      .or(z.literal("")),
    attachmentName: z.string().max(255).optional().or(z.literal("")),
  })
  .refine((d) => Boolean(d.body) || Boolean(d.attachmentB64), {
    message: "Saisissez un message ou joignez un document.",
  });
export type SendDirectMessageInput = z.infer<typeof sendDirectMessageSchema>;
