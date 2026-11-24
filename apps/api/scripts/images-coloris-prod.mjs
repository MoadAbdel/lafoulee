// Ajoute en production les photos par coloris du catalogue (seed-data/catalog.json), sans rien supprimer :
// - une photo déjà présente (même adresse) reçoit seulement son coloris ;
// - une photo absente est ajoutée à la suite des autres.
// Les commandes, les comptes et les stocks ne sont pas touchés. Relançable sans effet de bord.
// Usage (depuis apps/api) : node scripts/images-coloris-prod.mjs --confirmer
import { readFileSync } from "node:fs";
import pg from "pg";

if (!process.argv.includes("--confirmer")) {
  console.error("Ajoutez --confirmer pour écrire dans la base de production.");
  process.exit(1);
}
process.loadEnvFile("../../.env.local");
const res = await fetch(
  "https://console.neon.tech/api/v2/projects/fancy-leaf-62592713/connection_uri?database_name=neondb&role_name=neondb_owner&pooled=false",
  { headers: { authorization: `Bearer ${process.env.NEON_API_KEY}` } },
);
if (!res.ok) throw new Error(`API Neon : HTTP ${res.status}`);
const url = new URL((await res.json()).uri);
url.searchParams.set("sslmode", "verify-full");

const { products } = JSON.parse(readFileSync(new URL("../prisma/seed-data/catalog.json", import.meta.url), "utf8"));
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
let ajoutees = 0,
  colorees = 0;
await client.query("BEGIN");
for (const product of products) {
  const row = (await client.query("SELECT id FROM products WHERE slug = $1", [product.slug])).rows[0];
  if (!row) continue;
  for (const image of product.images ?? []) {
    if (!image.color) continue;
    const existing = await client.query(
      "UPDATE product_images SET color = $3 WHERE product_id = $1 AND blob_url = $2 AND color IS DISTINCT FROM $3",
      [row.id, image.url, image.color],
    );
    colorees += existing.rowCount;
    const present = await client.query("SELECT 1 FROM product_images WHERE product_id = $1 AND blob_url = $2", [
      row.id,
      image.url,
    ]);
    if (present.rowCount === 0) {
      await client.query(
        `INSERT INTO product_images (id, product_id, blob_url, alt, color, position)
         VALUES (gen_random_uuid(), $1, $2, $3, $4,
           (SELECT COALESCE(MAX(position), -1) + 1 FROM product_images WHERE product_id = $1))`,
        [row.id, image.url, image.alt, image.color],
      );
      ajoutees += 1;
    }
  }
}
await client.query("COMMIT");
const total = (await client.query("SELECT count(*)::int n, count(color)::int c FROM product_images")).rows[0];
await client.end();
console.log(
  `photos ajoutées : ${ajoutees}, coloris renseignés : ${colorees}, total : ${total.n} photos dont ${total.c} avec coloris`,
);
