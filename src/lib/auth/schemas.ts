import { z } from "zod";

const passwordRule = z
  .string()
  .min(8, "8 caractères minimum")
  .regex(/[A-Z]/, "Au moins 1 majuscule")
  .regex(/\d/, "Au moins 1 chiffre");

const phoneRule = z
  .string()
  .min(8, "Numéro trop court")
  .regex(/^[0-9 +().-]+$/, "Format de numéro invalide");

export const loginSchema = z.object({
  email: z.email("Email invalide").toLowerCase(),
  password: z.string().min(1, "Mot de passe requis"),
  remember: z.boolean().optional(),
  from: z.string().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    firstName: z
      .string()
      .min(2, "Prénom trop court")
      .max(60, "Prénom trop long")
      .trim(),
    lastName: z
      .string()
      .min(2, "Nom trop court")
      .max(60, "Nom trop long")
      .trim(),
    email: z.email("Email invalide").toLowerCase(),
    phone: phoneRule,
    addressLine: z.string().min(3, "Adresse trop courte").max(200),
    postalCode: z
      .string()
      .min(4, "Code postal invalide")
      .max(10, "Code postal invalide"),
    city: z.string().min(1, "Ville requise").max(80),
    country: z.string().min(2, "Pays requis").max(60),
    password: passwordRule,
    passwordConfirmation: z.string(),
    acceptTerms: z.literal(true, {
      error: () => ({
        message: "Vous devez accepter les conditions d'utilisation",
      }),
    }),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Les mots de passe ne correspondent pas",
  });
export type SignupInput = z.infer<typeof signupSchema>;

export const resetRequestSchema = z.object({
  email: z.email("Email invalide").toLowerCase(),
});
export type ResetRequestInput = z.infer<typeof resetRequestSchema>;

export const resetApplySchema = z
  .object({
    token: z.string().min(1),
    password: passwordRule,
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Les mots de passe ne correspondent pas",
  });
export type ResetApplyInput = z.infer<typeof resetApplySchema>;
