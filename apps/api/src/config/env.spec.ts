import { generateKeyPairSync, randomBytes } from "node:crypto";
import { loadEnv } from "./env.js";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const b64 = (pem: string | Buffer) => Buffer.from(pem).toString("base64");

const valid = {
  DATABASE_URL: "postgresql://u:p@localhost:5433/db",
  UPSTASH_REDIS_REST_URL: "http://localhost:8079",
  UPSTASH_REDIS_REST_TOKEN: "t",
  JWT_PRIVATE_KEY_B64: b64(privateKey.export({ type: "pkcs8", format: "pem" })),
  JWT_PUBLIC_KEY_B64: b64(publicKey.export({ type: "spki", format: "pem" })),
  TOTP_ENC_KEY: randomBytes(32).toString("base64"),
  CRON_SECRET: "0123456789abcdef0123",
};

describe("loadEnv (validation de la configuration)", () => {
  it("TB30a accepte une configuration complète et décode les clés PEM", () => {
    const config = loadEnv({ ...valid });
    expect(config.JWT_PRIVATE_KEY_B64).toContain("-----BEGIN PRIVATE KEY-----");
    expect(config.APP_ORIGIN).toBe("http://localhost:3000");
  });

  it("TB30b refuse de démarrer si une variable manque, sans afficher de valeur secrète", () => {
    const { DATABASE_URL: _removed, ...incomplete } = valid;
    expect(() => loadEnv(incomplete)).toThrow(/DATABASE_URL/);
    try {
      loadEnv({ ...valid, TOTP_ENC_KEY: "trop-court" });
    } catch (error) {
      expect(String(error)).toContain("TOTP_ENC_KEY");
      expect(String(error)).not.toContain("trop-court");
    }
  });

  it("accepte les noms de variables de l'intégration Upstash du Marketplace (KV_REST_API_*)", () => {
    const { UPSTASH_REDIS_REST_URL: _u, UPSTASH_REDIS_REST_TOKEN: _t, ...rest } = valid;
    const config = loadEnv({ ...rest, KV_REST_API_URL: "https://eu.upstash.io", KV_REST_API_TOKEN: "kv-token" });
    expect(config.UPSTASH_REDIS_REST_URL).toBe("https://eu.upstash.io");
    expect(config.UPSTASH_REDIS_REST_TOKEN).toBe("kv-token");
  });

  it("en Preview sans APP_ORIGIN, utilise l'URL de branche Vercel", () => {
    const config = loadEnv({ ...valid, VERCEL_BRANCH_URL: "lafoulee-git-feat-moadabdels-projects.vercel.app" });
    expect(config.APP_ORIGIN).toBe("https://lafoulee-git-feat-moadabdels-projects.vercel.app");
  });
});
