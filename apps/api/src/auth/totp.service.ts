import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "@upstash/redis";
import { generateSecret, generateURI, verify } from "otplib";
import { ENV, type Env } from "../config/env.js";
import { decrypt, encrypt } from "../common/crypto.js";
import { REDIS } from "../redis/redis.constants.js";

/**
 * Double authentification TOTP (RFC 6238) pour les administrateurs.
 * - le secret est stocké chiffré en AES-256-GCM ;
 * - tolérance de 30 s pour le décalage d'horloge du téléphone ;
 * - un code déjà accepté est refusé pendant 90 s (anti-rejeu).
 */
@Injectable()
export class TotpService {
  constructor(
    @Inject(ENV) private readonly config: Env,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  createSecret(email: string): { secret: string; secretEnc: string; uri: string } {
    const secret = generateSecret();
    return {
      secret,
      secretEnc: encrypt(secret, this.config.TOTP_ENC_KEY),
      uri: generateURI({ issuer: "La Foulée", label: email, secret }),
    };
  }

  async check(userId: string, secretEnc: string, code: string): Promise<boolean> {
    const secret = decrypt(secretEnc, this.config.TOTP_ENC_KEY);
    const result = await verify({ secret, token: code, epochTolerance: 30 });
    if (!result.valid) return false;
    // SET NX : échoue si le même code a déjà servi pour ce compte.
    const firstUse = await this.redis.set(`totp-used:${userId}:${code}`, 1, { nx: true, ex: 90 });
    return firstUse === "OK";
  }
}
