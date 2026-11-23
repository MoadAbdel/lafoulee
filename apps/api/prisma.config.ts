import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// En local, les variables viennent du .env.local de la racine du dépôt.
// Sur Vercel et en CI, elles sont déjà dans l'environnement.
config({ path: ["../../.env.local", ".env.local"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
