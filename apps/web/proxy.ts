import { NextResponse, type NextRequest } from "next/server";

/**
 * Espace client : sans aucun cookie de session, redirection immédiate (307)
 * vers la connexion. La validité réelle de la session reste vérifiée par l'API.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("lf_at") || request.cookies.has("lf_rt");
  if (!hasSession) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/compte/:path*"],
};
