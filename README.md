# La Foulée

Boutique en ligne de course à pied (chaussures, textile, nutrition) pour une enseigne fictive de trois magasins à Lyon.
Projet fil rouge de la certification Développeur Full Stack (RNCP 38606).

- Production : https://lafoulee.vercel.app
- Pile : Next.js 16 (`apps/web`), NestJS 12 (`apps/api`), PostgreSQL (Neon), Redis (Upstash), Vercel Services.

## Démarrer en local

Prérequis : Node.js 24, Docker Desktop.

```bash
npm ci
cp .env.example .env.local
docker compose up -d          # PostgreSQL + Redis
npm run dev:api               # API sur http://localhost:4000/api/v1/health
API_DEV_URL=http://localhost:4000 npm run dev:web   # site sur http://localhost:3000
```

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
