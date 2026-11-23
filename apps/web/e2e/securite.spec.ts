import { expect, test } from "@playwright/test";

/** TS01, TE05 : en-têtes de sécurité et protection des espaces privés. */
test.describe("Sécurité", () => {
  test("TS01 en-têtes de sécurité sur les pages du site", async ({ request }) => {
    for (const path of ["/", "/produits", "/commande"]) {
      const res = await request.get(path);
      const headers = res.headers();
      const csp = headers["content-security-policy"] ?? "";
      expect(csp, path).toContain("frame-ancestors 'none'");
      expect(csp, path).toContain("object-src 'none'");
      expect(headers["x-powered-by"], path).toBeUndefined();
    }
  });

  test("TE05 /admin et /compte sans session : redirection vers la connexion", async ({ page }) => {
    for (const path of ["/admin", "/admin/commandes", "/compte"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/connexion$/);
    }
  });

  test("API admin et partenaires refusées sans session ni clé", async ({ request }) => {
    expect((await request.get("/api/v1/admin/dashboard")).status()).toBe(401);
    expect((await request.get("/api/v1/partner/products")).status()).toBe(401);
    expect((await request.get("/api/v1/partner/openapi.json")).status()).toBe(200);
  });

  test("écriture depuis un autre site refusée (CSRF)", async ({ request }) => {
    const res = await request.post("/api/v1/auth/login", {
      headers: { origin: "https://evil.example" },
      data: { email: "x@exemple.fr", password: "x" },
    });
    expect(res.status()).toBe(403);
  });
});
