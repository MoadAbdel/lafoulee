import type { ExecutionContext } from "@nestjs/common";
import { OriginGuard } from "./origin.guard.js";

function context(method: string, headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ method, headers }) }),
  } as unknown as ExecutionContext;
}

describe("OriginGuard (CSRF)", () => {
  const guard = new OriginGuard();

  it("laisse passer les lectures", () => {
    expect(guard.canActivate(context("GET", { origin: "https://evil.example", host: "lafoulee.vercel.app" }))).toBe(
      true,
    );
  });

  it("laisse passer une écriture de même origine", () => {
    expect(
      guard.canActivate(context("POST", { origin: "https://lafoulee.vercel.app", host: "lafoulee.vercel.app" })),
    ).toBe(true);
  });

  it("utilise x-forwarded-host derrière le proxy Vercel", () => {
    expect(
      guard.canActivate(
        context("POST", {
          origin: "https://lafoulee.vercel.app",
          host: "interne",
          "x-forwarded-host": "lafoulee.vercel.app",
        }),
      ),
    ).toBe(true);
  });

  it("laisse passer un appel serveur sans en-tête Origin", () => {
    expect(guard.canActivate(context("POST", { host: "lafoulee.vercel.app" }))).toBe(true);
  });

  it("refuse une écriture venant d'un autre site", () => {
    expect(() =>
      guard.canActivate(context("POST", { origin: "https://evil.example", host: "lafoulee.vercel.app" })),
    ).toThrow("Origine non autorisée.");
  });

  it("refuse une origine mal formée", () => {
    expect(() => guard.canActivate(context("DELETE", { origin: "null", host: "lafoulee.vercel.app" }))).toThrow();
  });
});
