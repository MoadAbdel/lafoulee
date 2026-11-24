import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "@upstash/redis";
import { generateSecret, generateURI, verify } from "otplib";
import { ENV, type Env } from "../config/env.js";
import { decrypt, encrypt } from "../common/crypto.js";
import { REDIS } from "../redis/redis.constants.js";
import { redisKey } from "../redis/redis-key.js";

/**
 * Double authentification TOTP (RFC 6238) : obligatoire pour les administrateurs,
 * facultative (et conseillée) pour les clients.
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

  /**
   * Début d'activation : le secret attend 10 minutes dans Redis, chiffré, tant que
   * le premier code n'a pas prouvé que l'application est bien configurée.
   */
  async startEnrollment(userId: string, email: string): Promise<{ secret: string; uri: string }> {
    const { secret, secretEnc, uri } = this.createSecret(email);
    await this.redis.set(redisKey("totp-setup", userId), secretEnc, { ex: 600 });
    return { secret, uri };
  }

  /** Fin d'activation : renvoie le secret chiffré si le code est bon, sinon null. */
  async confirmEnrollment(userId: string, code: string): Promise<string | null> {
    const key = redisKey("totp-setup", userId);
    const secretEnc = await this.redis.get<string>(key);
    if (!secretEnc || !(await this.check(userId, secretEnc, code))) return null;
    await this.redis.del(key);
    return secretEnc;
  }

  async check(userId: string, secretEnc: string, code: string): Promise<boolean> {
    const secret = decrypt(secretEnc, this.config.TOTP_ENC_KEY);
    const result = await verify({ secret, token: code, epochTolerance: 30 });
    if (!result.valid) return false;
    // SET NX : échoue si le même code a déjà servi pour ce compte.
    const firstUse = await this.redis.set(redisKey("totp-used", userId, code), 1, { nx: true, ex: 90 });
    return firstUse === "OK";
  }
}
