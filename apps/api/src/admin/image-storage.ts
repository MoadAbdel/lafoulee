import { randomUUID } from "node:crypto";
import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { del, put } from "@vercel/blob";
import { ENV, type Env } from "../config/env.js";

/**
 * Seul point de contact avec Vercel Blob (photos produits, EA03).
 * Les tests remplacent cette classe : aucun appel réseau en CI.
 */
@Injectable()
export class ImageStorage {
  constructor(@Inject(ENV) private readonly config: Env) {}

  private token(): string {
    const token = this.config.BLOB_READ_WRITE_TOKEN;
    if (!token) throw new ServiceUnavailableException("Le stockage des images n'est pas configuré.");
    return token;
  }

  /** Nom de fichier aléatoire : l'adresse publique ne révèle rien et ne peut pas être devinée. */
  async upload(productId: string, data: Buffer, contentType: string, extension: string): Promise<string> {
    const blob = await put(`produits/${productId}/${randomUUID()}.${extension}`, data, {
      access: "public",
      contentType,
      token: this.token(),
      cacheControlMaxAge: 31_536_000, // fichier jamais modifié : un nouveau nom à chaque envoi
    });
    return blob.url;
  }

  async remove(url: string): Promise<void> {
    await del(url, { token: this.token() });
  }
}

/**
 * Reconnaît le format réel d'après les premiers octets, sans faire confiance à
 * l'en-tête Content-Type envoyé par le navigateur.
 */
export function detectImage(data: Buffer): { contentType: string; extension: string } | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { contentType: "image/png", extension: "png" };
  }
  if (data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}
