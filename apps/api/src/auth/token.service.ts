import { Inject, Injectable } from "@nestjs/common";
import { importPKCS8, importSPKI, jwtVerify, SignJWT, type CryptoKey } from "jose";
import type { UserRole } from "@lafoulee/shared";
import { ENV, type Env } from "../config/env.js";

const ISSUER = "lafoulee-api";
const ALG = "ES256";
export const ACCESS_TTL_SECONDS = 15 * 60;
const CHALLENGE_TTL_SECONDS = 5 * 60;

export interface AccessClaims {
  sub: string;
  role: UserRole;
}

/**
 * Jetons signés en ES256 (courbe P-256). La clé privée signe, la clé publique vérifie.
 * - jeton d'accès : 15 min, audience "session" ;
 * - défi TOTP : 5 min, audience "totp", émis après un mot de passe correct.
 */
@Injectable()
export class TokenService {
  private keys: Promise<{ privateKey: CryptoKey; publicKey: CryptoKey }> | undefined;

  constructor(@Inject(ENV) private readonly config: Env) {}

  private loadKeys() {
    this.keys ??= Promise.all([
      importPKCS8(this.config.JWT_PRIVATE_KEY_B64, ALG),
      importSPKI(this.config.JWT_PUBLIC_KEY_B64, ALG),
    ]).then(([privateKey, publicKey]) => ({ privateKey, publicKey }));
    return this.keys;
  }

  async signAccess(claims: AccessClaims): Promise<string> {
    const { privateKey } = await this.loadKeys();
    return new SignJWT({ role: claims.role })
      .setProtectedHeader({ alg: ALG })
      .setSubject(claims.sub)
      .setIssuer(ISSUER)
      .setAudience("session")
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
      .sign(privateKey);
  }

  async verifyAccess(token: string): Promise<AccessClaims> {
    const { publicKey } = await this.loadKeys();
    const { payload } = await jwtVerify(token, publicKey, { issuer: ISSUER, audience: "session", algorithms: [ALG] });
    if (typeof payload.sub !== "string" || (payload.role !== "CUSTOMER" && payload.role !== "ADMIN")) {
      throw new Error("Jeton mal formé");
    }
    return { sub: payload.sub, role: payload.role };
  }

  async signTotpChallenge(userId: string): Promise<string> {
    const { privateKey } = await this.loadKeys();
    return new SignJWT({})
      .setProtectedHeader({ alg: ALG })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setAudience("totp")
      .setIssuedAt()
      .setExpirationTime(`${CHALLENGE_TTL_SECONDS}s`)
      .sign(privateKey);
  }

  async verifyTotpChallenge(token: string): Promise<string> {
    const { publicKey } = await this.loadKeys();
    const { payload } = await jwtVerify(token, publicKey, { issuer: ISSUER, audience: "totp", algorithms: [ALG] });
    if (typeof payload.sub !== "string") throw new Error("Défi mal formé");
    return payload.sub;
  }
}
