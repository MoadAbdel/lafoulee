import { defineConfig } from "vitest/config";

// Couverture globale (tests unitaires + e2e), seuil bloquant de 60 % (dossier, ENF05).
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: "./",
    include: ["src/**/*.spec.ts", "test/**/*.e2e-spec.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      // Le paquet partagé (schémas Zod, règles de prix) est exécuté par ces tests : on le mesure ici.
      include: ["src/**/*.ts", "../../packages/shared/src/**/*.ts"],
      allowExternal: true,
      exclude: ["src/generated/**", "src/main.ts", "src/**/*.module.ts", "src/**/*.spec.ts"],
      reporter: ["text-summary", "text", "lcov"],
      thresholds: { lines: 60, branches: 60, functions: 60, statements: 60 },
    },
  },
});
