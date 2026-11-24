// Remise à zéro de la démonstration en PRODUCTION, avant la soutenance.
// 1. supprime les commandes de test (lignes et paiements suivent), les événements Stripe
//    et les comptes de test *@test.lafoulee.example ; remet les réservations de stock à 0 ;
// 2. charge le vrai catalogue (prisma db seed) : les anciens produits fictifs sont supprimés.
// Les comptes admin et client de démonstration, et les autres comptes, sont gardés.
// Lancement (depuis apps/api, clé NEON_API_KEY dans ../../.env.local) :
//   node scripts/reset-prod-demo.mjs --confirmer
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { delimiter, resolve } from "node:path";
import pg from "pg";

if (!process.argv.includes("--confirmer")) {
  console.error("Action irréversible sur la production : relancez avec --confirmer.");
  process.exit(1);
}
process.loadEnvFile("../../.env.local");
const res = await fetch(
  "https://console.neon.tech/api/v2/projects/fancy-leaf-62592713/connection_uri?database_name=neondb&role_name=neondb_owner&pooled=false",
  { headers: { authorization: `Bearer ${process.env.NEON_API_KEY}` } },
);
if (!res.ok) throw new Error(`API Neon : HTTP ${res.status}`);
const { uri: raw } = await res.json();
// Mode SSL explicite (le plus strict) : évite l'avertissement de pg sur "sslmode=require".
const url = new URL(raw);
url.searchParams.set("sslmode", "verify-full");
const uri = url.toString();

const client = new pg.Client({ connectionString: uri });
await client.connect();
const counts = async () =>
  (
    await client.query(
      "select (select count(*) from orders)::int commandes, (select count(*) from stripe_events)::int evenements, (select count(*) from users)::int comptes, (select count(*) from products)::int produits",
    )
  ).rows[0];
console.log("avant :", await counts());
await client.query("BEGIN");
await client.query("DELETE FROM orders");
await client.query("DELETE FROM stripe_events");
const removed = await client.query("DELETE FROM users WHERE email LIKE '%@test.lafoulee.example' RETURNING email");
await client.query("UPDATE stocks SET reserved = 0");
await client.query("COMMIT");
console.log(`comptes de test supprimés : ${removed.rowCount}`);
await client.end();

// La CLI Prisma est lancée directement avec node (pas de shell : aucun argument interprété).
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");
// Le seed lance "tsx" : on ajoute les outils du projet au PATH, comme le ferait npm.
const bins = [resolve("node_modules/.bin"), resolve("../../node_modules/.bin")];
const pathKey = Object.keys(process.env).find((key) => key.toUpperCase() === "PATH") ?? "PATH";
execFileSync(process.execPath, [prismaCli, "db", "seed"], {
  stdio: "inherit",
  env: { ...process.env, [pathKey]: [...bins, process.env[pathKey]].join(delimiter), DATABASE_URL: uri },
});

const check = new pg.Client({ connectionString: uri });
await check.connect();
console.log(
  "après :",
  (
    await check.query(
      "select (select count(*) from orders)::int commandes, (select count(*) from users)::int comptes, (select count(*) from products where status = 'PUBLISHED')::int produits_publies",
    )
  ).rows[0],
);
await check.end();
