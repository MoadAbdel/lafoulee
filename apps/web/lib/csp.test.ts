import { buildCsp } from "./csp";

const directive = (csp: string, name: string) => csp.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";

describe("buildCsp (C16)", () => {
  it("TS01 directives strictes : pas d'objet, pas d'intégration dans un cadre, formulaires et base limités", () => {
    const csp = buildCsp();
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "form-action")).toBe("form-action 'self'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("autorise seulement Stripe, l'API Adresse et la carte Google (contenu tiers soumis au consentement)", () => {
    const csp = buildCsp();
    expect(directive(csp, "connect-src")).toBe("connect-src 'self' https://api.stripe.com https://data.geopf.fr");
    expect(directive(csp, "frame-src")).toBe(
      "frame-src https://js.stripe.com https://hooks.stripe.com https://www.google.com",
    );
    expect(directive(csp, "script-src")).not.toContain("unsafe-eval");
  });

  it("unsafe-eval seulement en développement, vercel.live seulement en Preview", () => {
    expect(directive(buildCsp({ dev: true }), "script-src")).toContain("'unsafe-eval'");
    expect(buildCsp({ dev: true })).not.toContain("upgrade-insecure-requests");
    expect(buildCsp({ https: false })).not.toContain("upgrade-insecure-requests"); // http://localhost en CI
    expect(buildCsp({ preview: true })).toContain("https://vercel.live");
    expect(buildCsp()).not.toContain("vercel.live");
  });
});
