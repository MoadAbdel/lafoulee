import { defineConfig } from "vitest/config";

// Tests e2e : vraie base PostgreSQL et vrai Redis (docker compose en local,
// services de conteneur en CI). Exécution séquentielle : la base est partagée.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: "./",
    include: ["test/**/*.e2e-spec.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
