import { Injectable } from "@nestjs/common";
import { hash, verify } from "@node-rs/argon2";

// Paramètres Argon2id recommandés par l'OWASP (19 Mio, 2 itérations, 1 fil).
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class PasswordService {
  /** Empreinte factice : vérifiée quand l'email est inconnu, pour un temps de réponse identique. */
  private dummyHash: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return hash(password, OPTIONS);
  }

  async verify(storedHash: string | null, password: string): Promise<boolean> {
    if (!storedHash) {
      this.dummyHash ??= hash("mot-de-passe-factice", OPTIONS);
      await verify(await this.dummyHash, password);
      return false;
    }
    try {
      return await verify(storedHash, password);
    } catch {
      return false;
    }
  }
}
