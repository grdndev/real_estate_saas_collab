import { z } from "zod";

export const createInvoiceSchema = z.object({
  dossierId: z.string().min(1),
  number: z
    .string()
    .trim()
    .min(1, "Numéro de facture requis")
    .max(60, "Numéro trop long"),
  amountHT: z.coerce.number().min(0).max(9_999_999),
  vatRate: z.coerce.number().min(0).max(100),
  amountTTC: z.coerce.number().min(0).max(9_999_999),
  // PDF de la facture encodé en base64 (optionnel).
  fileB64: z
    .string()
    .max(8_000_000, "Fichier trop volumineux")
    .optional()
    .or(z.literal("")),
  fileName: z.string().max(255).optional().or(z.literal("")),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
