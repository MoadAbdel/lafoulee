import { PasswordService } from "./password.service.js";

describe("PasswordService (Argon2id)", () => {
  const service = new PasswordService();

  it("TB15 hache en Argon2id, avec un sel différent à chaque fois", async () => {
    const a = await service.hash("Foulee-2026-lyon");
    const b = await service.hash("Foulee-2026-lyon");
    expect(a).toMatch(/^\$argon2id\$/);
    expect(a).not.toBe(b);
  });

  it("vérifie le bon mot de passe et refuse le mauvais", async () => {
    const stored = await service.hash("Foulee-2026-lyon");
    expect(await service.verify(stored, "Foulee-2026-lyon")).toBe(true);
    expect(await service.verify(stored, "foulee-2026-lyon")).toBe(false);
  });

  it("répond false (sans exception) pour un compte inconnu ou une empreinte corrompue", async () => {
    expect(await service.verify(null, "nimporte")).toBe(false);
    expect(await service.verify("pas-une-empreinte", "nimporte")).toBe(false);
  });
});
