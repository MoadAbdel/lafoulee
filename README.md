# La Foulée

Boutique en ligne de course à pied (chaussures, textile, nutrition) pour une enseigne fictive de trois magasins à Lyon.
Projet fil rouge de la certification Développeur Full Stack (RNCP 38606).

- Production : https://lafoulee.vercel.app
- Pile : Next.js 16 (`apps/web`), NestJS 12 (`apps/api`), PostgreSQL (Neon), Redis (Upstash), Vercel Services.

## Démarrer en local

Prérequis : Node.js 24, Docker Desktop.

```bash
npm ci
cp .env.example .env.local    # puis compléter les clés (voir ci-dessous)
docker compose up -d          # PostgreSQL (port 5433) + Redis
npm run db:migrate -w apps/api
npm run db:seed -w apps/api   # 3 boutiques, 40 produits, 415 variantes
npm run dev:api               # API sur http://localhost:4000/api/v1/health
npm run dev:web               # site sur http://localhost:3000
```

Clés locales à ajouter dans `.env.local` (générées une fois) :

```bash
node -e 'const c=require("crypto");const k=c.generateKeyPairSync("ec",{namedCurve:"P-256"});const b=s=>Buffer.from(s).toString("base64");console.log("JWT_PRIVATE_KEY_B64="+b(k.privateKey.export({type:"pkcs8",format:"pem"})));console.log("JWT_PUBLIC_KEY_B64="+b(k.publicKey.export({type:"spki",format:"pem"})));console.log("TOTP_ENC_KEY="+c.randomBytes(32).toString("base64"));console.log("CRON_SECRET="+c.randomBytes(24).toString("hex"))'
```

Compte administrateur (mot de passe et QR code TOTP affichés une seule fois) :

```bash
npm run admin:create -w apps/api -- admin@exemple.fr
```

Sans clé Brevo, les emails (lien de vérification) sont écrits dans les logs de l'API.

## Vérifications

```bash
npm run format:check && npm run lint && npm run typecheck && npm test
```

## Structure

```
apps/web     Next.js (pages publiques + /admin)
apps/api     NestJS (un module par domaine), préfixe /api/v1
packages/    code partagé (schémas de validation)
vercel.json  deux services Vercel, routes, en-têtes de sécurité
```
