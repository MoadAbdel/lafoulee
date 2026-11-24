import { expect, test } from "@playwright/test";
import { chooseAvailableSize, openProductInStock, refuseCookies, watchCspViolations } from "./helpers";

test.describe("Parcours visiteur", () => {
  test("TC01 accueil, catalogue et fiche produit s'affichent @navigateurs", async ({ page }) => {
    const csp = watchCspViolations(page);
    await page.goto("/");
    await refuseCookies(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("essayée sur tapis avant de l");
    await page.getByRole("searchbox", { name: "Rechercher un produit" }).fill("trail");
    await page.getByRole("button", { name: "Rechercher" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("trail");
    await openProductInStock(page);
    await expect(page.getByText("Choisissez une taille pour voir le stock")).toBeVisible();
    expect(csp).toEqual([]);
  });

  test("TE01 tunnel complet en retrait boutique jusqu'au paiement Stripe", async ({ page }) => {
    // Le paiement crée un PaymentIntent : il faut une vraie clé Stripe de test côté API.
    // Le paiement par carte et le webhook sont couverts par les tests API (webhook signé)
    // et par un essai réel en production (dossier, annexe E13).
    test.skip(!process.env.E2E_STRIPE, "Clé Stripe de test absente.");
    const csp = watchCspViolations(page);
    await page.goto("/");
    await refuseCookies(page);
    await openProductInStock(page);
    await chooseAvailableSize(page);
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(page.getByText("Article ajouté.")).toBeVisible();

    await page.goto("/panier");
    await page.getByRole("link", { name: "Commander" }).click();
    await expect(page.getByText("Étape 1 sur 2")).toBeVisible();
    await page.getByLabel("Email pour la confirmation").fill(`e2e-${Date.now()}@test.lafoulee.example`);
    // Le stock est réservé par boutique : on essaie chaque boutique de retrait.
    const stores = page.getByLabel("Boutique de retrait");
    const slugs = await stores
      .locator("option")
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
    for (const slug of slugs) {
      await stores.selectOption(slug);
      await page.getByRole("button", { name: "Continuer vers le paiement" }).click();
      const outcome = await Promise.race([
        page
          .getByText("Étape 2 sur 2")
          .waitFor({ timeout: 20_000 })
          .then(() => "ok"),
        page
          .getByText(/Stock insuffisant/)
          .waitFor({ timeout: 20_000 })
          .then(() => "stock"),
      ]);
      if (outcome === "ok") break;
    }
    await expect(page.getByText("Étape 2 sur 2")).toBeVisible();
    await expect(page.getByText(/vos articles sont réservés pendant 30 minutes/)).toBeVisible();
    await expect(page.locator('iframe[src^="https://js.stripe.com/"]').first()).toBeAttached();
    await expect(page.getByRole("button", { name: /^Payer/ })).toBeVisible();
    expect(csp).toEqual([]);
  });
});
