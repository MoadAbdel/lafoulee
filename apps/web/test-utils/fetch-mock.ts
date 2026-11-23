import { vi } from "vitest";

type Handler = (url: string, init?: RequestInit) => { status?: number; body?: unknown } | undefined;

/**
 * Simule fetch selon l'URL appelée. Chaque route renvoie un statut et un corps JSON.
 * Les appels sont gardés pour vérifier ce qui a été envoyé.
 */
export function mockFetch(routes: Record<string, Handler | { status?: number; body?: unknown }>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const spy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    const key = Object.keys(routes)
      .sort((a, b) => b.length - a.length)
      .find((prefix) => url.includes(prefix));
    const route = key ? routes[key] : undefined;
    const result = typeof route === "function" ? route(url, init) : route;
    if (!result) return Promise.resolve(new Response(JSON.stringify({ message: "inconnu" }), { status: 404 }));
    const status = result.status ?? 200;
    return Promise.resolve(new Response(status === 204 ? null : JSON.stringify(result.body ?? {}), { status }));
  });
  return { spy, calls };
}
