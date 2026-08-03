import { z } from "zod";

const passwordRule = z
  .string()
  .min(8, "8 caractères minimum")
  .regex(/[A-Z]/, "Au moins 1 majuscule")
  .regex(/\d/, "Au moins 1 chiffre");

// Téléphone facultatif (T11) : seule la forme est contrôlée quand il est saisi.
const optionalPhoneRule = z
  .string()
  .trim()
  .max(30, "Numéro trop long")
  .regex(/^[0-9 +().-]*$/, "Format de numéro invalide")
  .optional()
  .or(z.literal(""));

/** Champ texte facultatif, borné en longueur. */
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const loginSchema = z.object({
  email: z.email("Email invalide").toLowerCase(),
  password: z.string().min(1, "Mot de passe requis"),
  remember: z.boolean().optional(),
  from: z.string().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    // Seuls prénom, nom et email sont obligatoires : l'email l'est ici car
    // c'est l'identifiant de connexion du compte créé (T11).
    firstName: z.string().trim().min(1, "Prénom requis").max(60),
    lastName: z.string().trim().min(1, "Nom requis").max(60),
    email: z.email("Email invalide").toLowerCase(),
    phone: optionalPhoneRule,
    addressLine: optionalText(200),
    postalCode: optionalText(10),
    city: optionalText(80),
    country: optionalText(60),
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
