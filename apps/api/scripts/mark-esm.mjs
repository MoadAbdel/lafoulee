// Vercel copie dist/ sans le package.json de l'application. Ce fichier indique
// à Node que dist/main.js est un module ESM (NestJS 12 est ESM uniquement).
import { writeFileSync } from "node:fs";

writeFileSync(new URL("../dist/package.json", import.meta.url), '{ "type": "module" }\n');
