import { z } from "zod";

/** Email normalisé (minuscules, sans espaces). */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, { error: "Adresse email trop longue." })
  .pipe(z.email({ error: "Adresse email invalide." }));

/**
 * Mot de passe : 12 caractères minimum et au moins 3 types de caractères
 * parmi minuscules, majuscules, chiffres et caractères spéciaux
 * (recommandation CNIL de 2022, environ 80 bits d'entropie).
 */
export const passwordSchema = z
  .string()
  .min(12, { error: "12 caractères minimum." })
  .max(128, { error: "128 caractères maximum." })
  .refine((value) => [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(value)).length >= 3, {
    error: "Utilisez au moins 3 types : minuscules, majuscules, chiffres, caractères spéciaux.",
  });

export const registerSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(60).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.strictObject({
  email: emailSchema,
  // Pas de règle de complexité à la connexion : on ne révèle rien sur la politique.
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const totpLoginSchema = z.strictObject({
  challenge: z.string().min(1).max(2048),
  code: z.string().regex(/^\d{6}$/, { error: "Le code contient 6 chiffres." }),
});
export type TotpLoginInput = z.infer<typeof totpLoginSchema>;

export const tokenSchema = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, { error: "Lien invalide." }),
});

export const resendVerificationSchema = z.strictObject({ email: emailSchema });

export type UserRole = "CUSTOMER" | "ADMIN";

export interface SessionUser {
  id: string;
  email: string;
  firstName: string | null;
  role: UserRole;
}

export type LoginResult = { status: "OK"; user: SessionUser } | { status: "TOTP_REQUIRED"; challenge: string };
