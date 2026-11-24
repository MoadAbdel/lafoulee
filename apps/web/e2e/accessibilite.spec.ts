import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { chooseAvailableSize, openProductInStock, refuseCookies } from "./helpers";

/**
 * TA01 (RGAA, ENF02) : aucune violation "serious" ou "critical" d'axe-core
 * sur les pages clés, y compris avec le bandeau de consentement ouvert.
 */
async function expectNoSeriousViolations(page: import("@playwright/test").Page, label: string) {
  // Les animations d'entrée (fondu) faussent la mesure du contraste : on analyse l'état final.
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== "running"));
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(
    serious.map((violation) => `${label} : ${violation.id} (${violation.nodes.length}) ${violation.help}`),
    `Violations d'accessibilité sur ${label}`,
  ).toEqual([]);
}

test.describe("Accessibilité (axe-core)", () => {
  test("accueil avec le bandeau de consentement ouvert", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Vos choix sur les cookies" })).toBeVisible();
    await expectNoSeriousViolations(page, "accueil + bandeau");
  });

  for (const [label, path] of [
    ["catalogue", "/produits"],
    ["recherche", "/produits?q=gel"],
    ["boutiques", "/boutiques"],
    ["connexion", "/connexion"],
    ["inscription", "/inscription"],
    ["confidentialité", "/confidentialite"],
    ["demande RGPD", "/confidentialite/demande"],
    ["panier vide", "/panier"],
  ] as const) {
    test(label, async ({ page }) => {
      await page.goto(path);
      await refuseCookies(page);
      await expect(page.locator("main")).toBeVisible();
      await expectNoSeriousViolations(page, label);
    });
  }

  test("fiche produit avec une pointure choisie, puis tunnel de commande", async ({ page }) => {
    await page.goto("/");
    await refuseCookies(page);
    await openProductInStock(page);
    await chooseAvailableSize(page);
    await expectNoSeriousViolations(page, "fiche produit");
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(page.getByText("Article ajouté.")).toBeVisible();
    await page.goto("/commande");
    await expect(page.getByText("Étape 1 sur 2")).toBeVisible();
    await expectNoSeriousViolations(page, "tunnel, étape 1");
    await page.getByRole("radio", { name: "Livraison à domicile" }).check();
    await expectNoSeriousViolations(page, "tunnel, livraison");
  });

  test("TA02 le tunnel se parcourt au clavier jusqu'au choix du mode de réception", async ({ page }) => {
    await page.goto("/connexion");
    await refuseCookies(page);
    await page.keyboard.press("Tab"); // lien d'évitement
    await expect(page.getByRole("link", { name: "Aller au contenu" })).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Email")).toBeFocused();
  });
});
