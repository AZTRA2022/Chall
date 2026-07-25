import { z } from "zod";

import { MINIMUM_AGE } from "@/constants/legal";

const email = z
  .string()
  .trim()
  .min(1, "L'adresse e-mail est obligatoire")
  .email("Adresse e-mail invalide");
const password = z
  .string()
  .min(8, "Le mot de passe doit faire au moins 8 caractères")
  .max(128, "Le mot de passe est trop long");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Le mot de passe est obligatoire"),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Les deux acceptations sont validées ici et pas seulement dans l'interface :
 * un bouton désactivé n'est pas une garantie, et ces deux champs conditionnent
 * la conformité de l'inscription.
 */
export const registerSchema = z
  .object({
    email,
    password,
    confirmPassword: z.string(),
    acceptedTerms: z.literal(true, {
      message:
        "Vous devez accepter les conditions d'utilisation et la politique de confidentialité",
    }),
    confirmedAge: z.literal(true, {
      message: `Vous devez déclarer avoir au moins ${MINIMUM_AGE} ans`,
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  email,
  code: z
    .string()
    .trim()
    .min(4, "Saisissez le code reçu")
    .max(8, "Saisissez le code reçu"),
  password,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export function fieldErrors<T>(error: z.ZodError<T>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}
