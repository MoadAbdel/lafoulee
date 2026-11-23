import { z } from "zod";
import { emailSchema } from "./auth.js";

/** Version du bandeau de consentement : la changer redemande le choix à tous les visiteurs. */
export const CONSENT_VERSION = "2026-11";
/** Recommandation CNIL : redemander le consentement au bout de 6 mois. */
export const CONSENT_MAX_AGE_DAYS = 182;

/** Catégories soumises au consentement. Les cookies essentiels (session, panier) n'en font pas partie. */
export const consentChoicesSchema = z.strictObject({
  contenusTiers: z.boolean(),
});
export type ConsentChoices = z.infer<typeof consentChoicesSchema>;

export const consentSchema = z.strictObject({
  consentId: z.uuid(),
  version: z.string().max(20),
  choices: consentChoicesSchema,
});
export type ConsentInput = z.infer<typeof consentSchema>;

export const GDPR_REQUEST_TYPES = ["ACCESS", "DELETION"] as const;
export type GdprRequestType = (typeof GDPR_REQUEST_TYPES)[number];

export const privacyRequestSchema = z.strictObject({
  email: emailSchema,
  type: z.enum(GDPR_REQUEST_TYPES),
});
export type PrivacyRequestInput = z.infer<typeof privacyRequestSchema>;

export const deleteAccountSchema = z.strictObject({
  password: z.string().min(1).max(128),
});

export const newsletterSchema = z.strictObject({ email: emailSchema });

export const unsubscribeSchema = z.strictObject({
  email: emailSchema,
  signature: z.string().regex(/^[a-f0-9]{64}$/),
});

export interface GdprRequestDto {
  id: string;
  email: string;
  type: GdprRequestType;
  status: "OPEN" | "DONE";
  hasAccount: boolean;
  createdAt: string;
  dueAt: string;
  closedAt: string | null;
}
