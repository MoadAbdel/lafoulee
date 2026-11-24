// Applique les migrations Prisma pendant le build Vercel, avant la mise en ligne du code.
// - Preview : sur la branche Neon créée pour ce déploiement (copie de la production) ;
// - Production : sur la branche principale.
// Ne fait rien en local ni en CI (VERCEL_ENV absent).
// Les migrations doivent rester additives : l'ancien code tourne quelques instants
// sur le nouveau schéma pendant le basculement.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

// CLI Prisma lancée directement avec node : pas de shell, pas de recherche dans le PATH.
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

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
// Neon met la base en veille : le premier essai peut échouer le temps du réveil (P1001).
const ATTEMPTS = 4;
for (let attempt = 1; ; attempt++) {
  try {
    execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: url },
    });
    break;
  } catch (error) {
    if (attempt === ATTEMPTS) throw error;
    const wait = attempt * 5;
    console.log(`migrate-on-vercel : essai ${attempt} échoué, nouvel essai dans ${wait} s.`);
    await new Promise((resolve) => setTimeout(resolve, wait * 1000));
  }
}
