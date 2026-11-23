import { NextRequest } from "next/server";
import { proxy } from "./proxy";

function request(path: string, cookies: Record<string, string> = {}): NextRequest {
  const req = new NextRequest(new URL(path, "https://lafoulee.vercel.app"));
  for (const [name, value] of Object.entries(cookies)) req.cookies.set(name, value);
  return req;
}

const location = (res: Response) => res.headers.get("location");

describe("proxy (redirections de session)", () => {
  it("espace client sans session : redirige vers la connexion", () => {
    const res = proxy(request("/compte"));
    expect(res.status).toBe(307);
    expect(location(res)).toBe("https://lafoulee.vercel.app/connexion");
  });

  it("espace client avec un cookie de rafraîchissement seul : laisse passer (la page renouvelle la session)", () => {
    expect(location(proxy(request("/compte", { lf_rt: "x" })))).toBeNull();
  });

  it("connexion et inscription avec une session active : redirige vers l'accueil", () => {
    for (const path of ["/connexion", "/inscription"]) {
      const res = proxy(request(path, { lf_at: "jeton" }));
      expect(res.status).toBe(307);
      expect(location(res)).toBe("https://lafoulee.vercel.app/");
    }
  });

  it("connexion avec seulement un cookie de rafraîchissement : la page reste accessible", () => {
    expect(location(proxy(request("/connexion", { lf_rt: "peut-etre-revoque" })))).toBeNull();
  });

  it("connexion sans session : page affichée", () => {
    expect(location(proxy(request("/connexion")))).toBeNull();
  });
});
