import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

/**
 * Variables d'environnement validées au démarrage (dossier, C21 :
 * "validation des configurations"). L'API refuse de démarrer si une variable
 * manque ou est mal formée, avec un message qui ne contient aucune valeur secrète.
 */
const base64Pem = z
  .string()
  .min(1)
  .transform((value) => Buffer.from(value, "base64").toString("utf8"))
  .refine((pem) => pem.includes("-----BEGIN"), { error: "doit être une clé PEM encodée en base64" });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ORIGIN: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.string().startsWith("postgres"),
  UPSTASH_REDIS_REST_URL: z.url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  JWT_PRIVATE_KEY_B64: base64Pem,
  JWT_PUBLIC_KEY_B64: base64Pem,
  TOTP_ENC_KEY: z
    .string()
    .refine((value) => Buffer.from(value, "base64").length === 32, { error: "doit faire 32 octets en base64" }),
  CRON_SECRET: z.string().min(16),
  BREVO_API_KEY: z.string().min(1).optional(),
  MAIL_FROM: z.email().default("no-reply@lafoulee.example"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** En local (hors Vercel), lit le .env.local de la racine du dépôt s'il existe. */
function loadLocalEnvFile(): void {
  if (process.env.VERCEL) return;
  const file = resolve(import.meta.dirname, "../../../../.env.local");
  if (existsSync(file)) process.loadEnvFile(file);
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (source === process.env) loadLocalEnvFile();
  // Déploiement Preview sans APP_ORIGIN : on prend l'URL stable de la branche.
  const appOrigin = source.APP_ORIGIN ?? (source.VERCEL_BRANCH_URL ? `https://${source.VERCEL_BRANCH_URL}` : undefined);
  const result = envSchema.safeParse({
    ...source,
    APP_ORIGIN: appOrigin,
    // L'intégration Upstash du Marketplace Vercel nomme ses variables KV_REST_API_*.
    UPSTASH_REDIS_REST_URL: source.UPSTASH_REDIS_REST_URL ?? source.KV_REST_API_URL,
    UPSTASH_REDIS_REST_TOKEN: source.UPSTASH_REDIS_REST_TOKEN ?? source.KV_REST_API_TOKEN,
  });
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")} : ${issue.message}`);
    throw new Error(`Configuration invalide :\n- ${problems.join("\n- ")}`);
  }
  return result.data;
}

export function env(): Env {
  cached ??= loadEnv();
  return cached;
}

export const ENV = Symbol("ENV");
