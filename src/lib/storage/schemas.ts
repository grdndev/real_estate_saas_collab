import { z } from "zod";

export const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 Mo (CDC §4.3)

export const prepareUploadSchema = z.object({
  dossierId: z.string().min(1),
  documentRequestId: z.string().min(1).optional().nullable(),
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_MIME, {
    error: () => ({
      message: "Format non autorisé. Acceptés : PDF, JPG, PNG, DOCX.",
    }),
  }),
  sizeBytes: z
    .number()
    .int()
    .min(1, "Fichier vide")
    .max(MAX_FILE_BYTES, "Fichier > 20 Mo (CDC §4.3)"),
  source: z.enum(["CLIENT_UPLOAD", "COLLABORATOR_UPLOAD"]),
});
export type PrepareUploadInput = z.infer<typeof prepareUploadSchema>;

export const documentIdSchema = z.object({
  documentId: z.string().min(1),
});
export type DocumentIdInput = z.infer<typeof documentIdSchema>;
