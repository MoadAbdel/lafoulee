import { NextResponse, type NextRequest } from "next/server";

const ACCESS_COOKIE = "lf_at";
const REFRESH_COOKIE = "lf_rt";
const GUEST_ONLY = ["/connexion", "/inscription"];

/**
 * Redirections selon la présence d'une session, avant tout rendu (code 307) :
 * - espace client sans aucun cookie de session : vers la connexion ;
 * - connexion ou inscription avec une session active : vers l'accueil.
 *
 * Pour la seconde règle, seul le cookie d'accès compte : il expire en même temps
 * que son jeton (15 min). Un cookie de rafraîchissement peut être révoqué :
 * s'y fier empêcherait de revenir sur la page de connexion.
 * La validité réelle de la session reste toujours vérifiée par l'API.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAccess = request.cookies.has(ACCESS_COOKIE);

  if (pathname.startsWith("/compte") && !hasAccess && !request.cookies.has(REFRESH_COOKIE)) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  if (GUEST_ONLY.includes(pathname) && hasAccess) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/compte/:path*", "/connexion", "/inscription"],
};
