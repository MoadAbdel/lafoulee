import { mockFetch } from "@/test-utils/fetch-mock";
import { getAccountProfile, getMyOrders, getSession } from "./session";

const jar = vi.hoisted(() => ({ cookies: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.cookies.has(name) ? { name, value: jar.cookies.get(name) } : undefined),
    has: (name: string) => jar.cookies.has(name),
  }),
}));

beforeEach(() => {
  jar.cookies.clear();
  vi.stubEnv("API_INTERNAL_URL", "http://api.test");
});
afterEach(() => vi.unstubAllEnvs());

describe("getSession", () => {
  it("anonyme sans aucun cookie, sans appel à l'API", async () => {
    const { calls } = mockFetch({});
    await expect(getSession()).resolves.toEqual({ status: "anonymous" });
    expect(calls).toHaveLength(0);
  });

  it("expirée quand seul le jeton de rafraîchissement existe", async () => {
    jar.cookies.set("lf_rt", "r");
    await expect(getSession()).resolves.toEqual({ status: "expired" });
  });

  it("authentifiée : transmet le cookie d'accès à l'API", async () => {
    jar.cookies.set("lf_at", "jeton");
    const user = { id: "u1", email: "lea@exemple.fr", role: "CUSTOMER" };
    const { calls } = mockFetch({ "/auth/me": { body: user } });
    await expect(getSession()).resolves.toEqual({ status: "authenticated", user });
    expect(calls[0].url).toBe("http://api.test/api/v1/auth/me");
    expect(calls[0].init?.headers).toEqual({ cookie: "lf_at=jeton" });
    expect(calls[0].init?.cache).toBe("no-store");
  });

  it("expirée quand l'API refuse le jeton d'accès", async () => {
    jar.cookies.set("lf_at", "perime");
    mockFetch({ "/auth/me": { status: 401 } });
    await expect(getSession()).resolves.toEqual({ status: "expired" });
  });
});

describe("getMyOrders", () => {
  it("liste vide sans cookie, sans appel", async () => {
    const { calls } = mockFetch({});
    await expect(getMyOrders()).resolves.toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("renvoie les commandes ; liste vide en cas d'erreur", async () => {
    jar.cookies.set("lf_at", "jeton");
    mockFetch({ "/me/orders": { body: [{ id: "o1" }] } });
    await expect(getMyOrders()).resolves.toEqual([{ id: "o1" }]);

    vi.restoreAllMocks();
    mockFetch({ "/me/orders": { status: 500 } });
    await expect(getMyOrders()).resolves.toEqual([]);
  });
});

describe("getAccountProfile", () => {
  it("null sans cookie", async () => {
    mockFetch({});
    await expect(getAccountProfile()).resolves.toBeNull();
  });

  it("renvoie le profil ; null si l'API refuse", async () => {
    jar.cookies.set("lf_at", "jeton");
    mockFetch({ "/me/profile": { body: { email: "lea@exemple.fr" } } });
    await expect(getAccountProfile()).resolves.toEqual({ email: "lea@exemple.fr" });

    vi.restoreAllMocks();
    mockFetch({ "/me/profile": { status: 401 } });
    await expect(getAccountProfile()).resolves.toBeNull();
  });
});
