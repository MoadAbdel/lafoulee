import { randomBytes } from "node:crypto";
import { decrypt, encrypt, randomToken, sha256 } from "./crypto.js";

const key = randomBytes(32).toString("base64");

describe("crypto", () => {
  it("randomToken produit 43 caractères base64url, différents à chaque appel", () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(a);
  });

  it("sha256 est déterministe et ne contient pas la valeur d'origine", () => {
    expect(sha256("abc")).toBe(sha256("abc"));
    expect(sha256("abc")).not.toContain("abc");
    expect(sha256("abc")).toHaveLength(64);
  });

  it("encrypt/decrypt : aller-retour, et chiffré différent à chaque fois (IV aléatoire)", () => {
    const first = encrypt("JBSWY3DPEHPK3PXP", key);
    expect(decrypt(first, key)).toBe("JBSWY3DPEHPK3PXP");
    expect(encrypt("JBSWY3DPEHPK3PXP", key)).not.toBe(first);
  });

  it("decrypt refuse une donnée modifiée (authentification GCM)", () => {
    const [iv, tag, data] = encrypt("secret", key).split(".");
    const tampered = [iv, tag, Buffer.from("autre").toString("base64url")].join(".");
    expect(() => decrypt(tampered, key)).toThrow();
    expect(() => decrypt(`${iv}.${tag}`, key)).toThrow();
    expect(data).toBeTruthy();
  });

  it("decrypt refuse une mauvaise clé", () => {
    const payload = encrypt("secret", key);
    expect(() => decrypt(payload, randomBytes(32).toString("base64"))).toThrow();
  });
});
