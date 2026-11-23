import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": resolve(import.meta.dirname, ".") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      include: ["app/**/*.{ts,tsx}", "components/**/*.tsx", "lib/**/*.ts", "proxy.ts"],
      // Pages serveur asynchrones et données : couvertes par les tests e2e de l'API et Playwright.
      exclude: [
        "**/*.test.*",
        "app/**/page.tsx",
        "app/layout.tsx",
        "app/not-found.tsx",
        "lib/catalog.ts",
        "lib/session.ts",
      ],
      reporter: ["text-summary", "text", "lcov"],
      thresholds: { lines: 60, branches: 60, functions: 60, statements: 60 },
    },
  },
});
