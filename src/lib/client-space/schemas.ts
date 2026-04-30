import { z } from "zod";

export const requestDocumentSchema = z.object({
  dossierId: z.string().min(1),
  label: z.string().min(2, "Libellé trop court").max(120),
  required: z.boolean().default(true),
});
export type RequestDocumentInput = z.infer<typeof requestDocumentSchema>;

export const cancelDocumentRequestSchema = z.object({
  requestId: z.string().min(1),
});
export type CancelDocumentRequestInput = z.infer<
  typeof cancelDocumentRequestSchema
>;

export const sendMessageSchema = z.object({
  dossierId: z.string().min(1),
  body: z
    .string()
    .min(1, "Message vide")
    .max(4000, "Message trop long (4000 caractères max)")
    .trim(),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const updateProfileSchema = z.object({
  firstName: z.string().min(2, "Prénom trop court").max(60).trim(),
  lastName: z.string().min(2, "Nom trop court").max(60).trim(),
  phone: z
    .string()
    .min(8, "Numéro trop court")
    .regex(/^[0-9 +().-]+$/, "Format invalide"),
  addressLine: z.string().min(3).max(200),
  postalCode: z.string().min(4).max(10),
  city: z.string().min(1).max(80),
  country: z.string().min(2).max(60),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(8, "8 caractères minimum")
      .regex(/[A-Z]/, "Au moins 1 majuscule")
      .regex(/\d/, "Au moins 1 chiffre"),
    newPasswordConfirmation: z.string(),
  })
  .refine((d) => d.newPassword === d.newPasswordConfirmation, {
    path: ["newPasswordConfirmation"],
    message: "Les mots de passe ne correspondent pas",
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
