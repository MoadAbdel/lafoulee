// Remise à zéro de la démonstration en PRODUCTION, avant la soutenance.
// 1. supprime les commandes de test (lignes et paiements suivent), les événements Stripe
//    et les comptes de test *@test.lafoulee.example ; remet les réservations de stock à 0 ;
// 2. charge le vrai catalogue (prisma db seed) : les anciens produits fictifs sont supprimés.
// Les comptes admin et client de démonstration, et les autres comptes, sont gardés.
// Lancement (depuis apps/api, clé NEON_API_KEY dans ../../.env.local) :
//   node scripts/reset-prod-demo.mjs --confirmer
import { execFileSync } from "node:child_process";
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
const { uri } = await res.json();

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

execFileSync("npx", ["prisma", "db", "seed"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DATABASE_URL: uri },
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
