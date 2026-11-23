/**
 * Préfixe des clés Redis par environnement. La base Redis (Upstash) est partagée
 * entre la production et les Previews, contrairement à PostgreSQL (une branche
 * Neon par Preview). Sans préfixe, un Preview pourrait remplir le cache du
 * catalogue avec ses données de test, servies ensuite en production.
 */
export function redisPrefix(source: NodeJS.ProcessEnv = process.env): string {
  if (source.VERCEL_ENV === "production") return "prod";
  if (source.VERCEL_ENV === "preview") {
    const branch = (source.VERCEL_GIT_COMMIT_REF ?? "inconnue").replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 60);
    return `preview:${branch}`;
  }
  return source.NODE_ENV === "test" ? "test" : "dev";
}

let prefix: string | undefined;

/** Construit une clé préfixée : redisKey("cart", id) -> "prod:cart:<id>". */
export function redisKey(...parts: (string | number)[]): string {
  prefix ??= redisPrefix();
  return [prefix, ...parts].join(":");
}
