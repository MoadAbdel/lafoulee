import { expect, type Page } from "@playwright/test";

/** Ferme le bandeau de consentement en refusant (choix le plus protecteur). */
export async function refuseCookies(page: Page): Promise<void> {
  const refuse = page.getByRole("button", { name: "Tout refuser" });
  if (await refuse.isVisible().catch(() => false)) await refuse.click();
}

/** Relève les violations de CSP signalées par le navigateur pendant le test. */
export function watchCspViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (/Content Security Policy|Content-Security-Policy/i.test(text)) violations.push(text);
  });
  return violations;
}

/** Ouvre une chaussure de route (la n-ième de la liste) et renvoie son adresse. */
export async function openProductInStock(page: Page, rank = 0): Promise<string> {
  await page.goto("/produits?categorie=chaussures-route");
  const card = page.getByRole("article").filter({ hasText: "à partir de" }).nth(rank);
  await card.getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return page.url();
}

/** Choisit la première pointure disponible ; renvoie false si aucune ne l'est. */
async function pickSize(page: Page): Promise<boolean> {
  const sizes = page.getByRole("group", { name: /Pointure|Taille/ }).getByRole("radio");
  const count = await sizes.count();
  for (let index = 0; index < count; index++) {
    const size = sizes.nth(index);
    if (await size.isEnabled()) {
      // Le bouton radio natif est masqué visuellement (libellé cliquable). Un clic arrivé avant
      // l'hydratation de React est annulé par celle-ci : on recommence jusqu'à ce qu'il tienne.
      await expect(async () => {
        await size.check({ force: true });
        await expect(size).toBeChecked({ timeout: 500 });
      }).toPass({ timeout: 10_000 });
      return true;
    }
  }
  return false;
}

/**
 * Choisit une pointure disponible sur la fiche ouverte. Si le produit n'a plus de
 * stock libre (réservations des tests précédents), passe aux produits suivants.
 */
export async function chooseAvailableSize(page: Page): Promise<void> {
  for (let rank = 1; rank <= 6; rank++) {
    if (await pickSize(page)) return;
    await openProductInStock(page, rank);
  }
  throw new Error("Aucune pointure disponible sur les premiers produits");
}
