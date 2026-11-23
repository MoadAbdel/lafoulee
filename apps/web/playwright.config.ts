import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout (dossier, annexe E13 : TE, TA, TS, TC).
 * Ils visent un site déjà lancé (BASE_URL), branché sur une vraie API et une vraie base :
 * en local avec docker compose, en CI avec les conteneurs de service.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    locale: "fr-FR",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // TC01 : compatibilité, sur les tests marqués @navigateurs seulement.
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, grep: /@navigateurs/ },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, grep: /@navigateurs/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@navigateurs/ },
  ],
});
