// Applique les migrations Prisma pendant le build Vercel, avant la mise en ligne du code.
// - Preview : sur la branche Neon créée pour ce déploiement (copie de la production) ;
// - Production : sur la branche principale.
// Ne fait rien en local ni en CI (VERCEL_ENV absent).
// Les migrations doivent rester additives : l'ancien code tourne quelques instants
// sur le nouveau schéma pendant le basculement.
import { execFileSync } from "node:child_process";

const target = process.env.VERCEL_ENV;
if (target !== "preview" && target !== "production") {
  console.log("migrate-on-vercel : hors Vercel, aucune migration.");
  process.exit(0);
}

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("migrate-on-vercel : aucune URL de base disponible.");
  process.exit(1);
}

console.log(`migrate-on-vercel : migrations sur l'environnement ${target}.`);
execFileSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DATABASE_URL: url },
});
