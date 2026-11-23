/**
 * Content Security Policy du site (dossier, C16).
 *
 * Compromis assumé : pas de nonce. Avec Next.js 16, un nonce oblige à rendre
 * chaque page à la requête et désactive le Partial Prerendering (plus de cache
 * des pages). Les scripts en ligne de Next.js (transmission des données React)
 * imposent alors 'unsafe-inline' pour les scripts. Toutes les autres directives
 * sont strictes, et les domaines tiers sont limités au strict nécessaire.
 */
interface CspOptions {
  dev?: boolean;
  preview?: boolean;
  /** Site servi en HTTPS (Vercel). Par défaut : vrai hors développement. */
  https?: boolean;
}

export function buildCsp({ dev = false, preview = false, https }: CspOptions = {}): string {
  const secure = https ?? !dev;
  const vercelLive = preview ? ["https://vercel.live"] : []; // barre d'outils des Previews
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(dev ? ["'unsafe-eval'"] : []),
      "https://js.stripe.com",
      ...vercelLive,
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://*.stripe.com"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", "https://api.stripe.com", "https://data.geopf.fr", ...vercelLive],
    "frame-src": ["https://js.stripe.com", "https://hooks.stripe.com", "https://www.google.com", ...vercelLive],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  // Seulement quand le site est servi en HTTPS (Vercel) : en local et en CI (http://localhost),
  // cette directive ferait échouer toutes les requêtes.
  if (secure) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}
