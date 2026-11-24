import { mockFetch } from "@/test-utils/fetch-mock";
import { ApiError, apiUrl, getJson } from "./api";

describe("apiUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("préfère API_INTERNAL_URL à API_DEV_URL", () => {
    vi.stubEnv("API_INTERNAL_URL", "http://api.interne:8080");
    vi.stubEnv("API_DEV_URL", "http://localhost:4000");
    expect(apiUrl("/products")).toBe("http://api.interne:8080/api/v1/products");
  });

  it("utilise API_DEV_URL en local", () => {
    delete process.env.API_INTERNAL_URL;
    vi.stubEnv("API_DEV_URL", "http://localhost:5000");
    expect(apiUrl("/stores")).toBe("http://localhost:5000/api/v1/stores");
  });

  it("retombe sur localhost:4000 sans variable", () => {
    delete process.env.API_INTERNAL_URL;
    delete process.env.API_DEV_URL;
    expect(apiUrl("/categories")).toBe("http://localhost:4000/api/v1/categories");
  });
});

describe("getJson (serveur)", () => {
  beforeEach(() => {
    vi.stubEnv("API_INTERNAL_URL", "http://api.test");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("renvoie le JSON et envoie l'en-tête accept", async () => {
    const { calls } = mockFetch({ "/api/v1/stores": { body: [{ slug: "gerland" }] } });
    await expect(getJson("/stores", { headers: { cookie: "lf_at=x" } })).resolves.toEqual([{ slug: "gerland" }]);
    expect(calls[0].url).toBe("http://api.test/api/v1/stores");
    expect(calls[0].init?.headers).toEqual({ accept: "application/json", cookie: "lf_at=x" });
  });

  it("renvoie null sur 404", async () => {
    mockFetch({ "/products/absent": { status: 404 } });
    await expect(getJson("/products/absent")).resolves.toBeNull();
  });

  it("lève une ApiError avec le statut sur les autres erreurs", async () => {
    mockFetch({ "/boom": { status: 503 } });
    const error = await getJson("/boom").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(503);
    expect((error as ApiError).message).toBe("API /boom : HTTP 503");
  });
});
