import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** Jeton aléatoire de 32 octets, encodé en base64url (43 caractères). */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Empreinte SHA-256 : seule l'empreinte d'un jeton est stockée en base. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Chiffrement AES-256-GCM (secrets TOTP). Format : iv.tag.chiffré, en base64url.
 * La clé vient de l'environnement, jamais de la base.
 */
export function encrypt(plain: string, keyBase64: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyBase64, "base64"), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64url")).join(".");
}

export function decrypt(payload: string, keyBase64: string): string {
  const [iv, tag, data] = payload.split(".").map((part) => Buffer.from(part, "base64url"));
  if (!iv || !tag || !data) throw new Error("Donnée chiffrée invalide");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(keyBase64, "base64"), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
