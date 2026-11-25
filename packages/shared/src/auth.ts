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

/** Version des conditions générales d'utilisation acceptées à l'inscription (date de publication). */
export const TERMS_VERSION = "2026-11-25";

export const registerSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(60).optional(),
  acceptTerms: z.literal(true, { error: "Acceptez les conditions générales d'utilisation pour créer un compte." }),
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

const totpCode = z.string().regex(/^\d{6}$/, { error: "Le code contient 6 chiffres." });
const currentPassword = z.string().min(1, { error: "Saisissez votre mot de passe actuel." }).max(128);

/** Mot de passe oublié : la réponse est la même que le compte existe ou non. */
export const forgotPasswordSchema = z.strictObject({ email: emailSchema });

export const resetPasswordSchema = z.strictObject({
  token: tokenSchema.shape.token,
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const profileUpdateSchema = z.strictObject({
  firstName: z.string().trim().min(1, { error: "Le prénom est vide." }).max(60).nullable(),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export const passwordChangeSchema = z
  .strictObject({ currentPassword, newPassword: passwordSchema })
  .refine((value) => value.currentPassword !== value.newPassword, {
    error: "Le nouveau mot de passe doit être différent de l'actuel.",
    path: ["newPassword"],
  });
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

export const emailChangeSchema = z.strictObject({ newEmail: emailSchema, currentPassword });
export type EmailChangeInput = z.infer<typeof emailChangeSchema>;

export const twoFactorSetupSchema = z.strictObject({ currentPassword });
export const twoFactorEnableSchema = z.strictObject({ code: totpCode });
export const twoFactorDisableSchema = z.strictObject({ currentPassword, code: totpCode });

/** Informations du compte, pour la page "Mon compte". */
export interface AccountProfileDto {
  email: string;
  firstName: string | null;
  role: UserRole;
  twoFactorEnabled: boolean;
  createdAt: string;
}

/** Début d'activation de la double authentification : QR code et clé à saisir à la main. */
export interface TwoFactorSetupDto {
  qrSvg: string;
  secret: string;
}
