import { mockFetch } from "@/test-utils/fetch-mock";
import { getCategories, getProduct, getProducts, getStores } from "./catalog";

const tags = vi.hoisted(() => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("next/cache", () => tags);

beforeEach(() => {
  vi.stubEnv("API_INTERNAL_URL", "http://api.test");
  tags.cacheLife.mockClear();
  tags.cacheTag.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("catalogue en cache", () => {
  it("catégories : étiquetées catalog, liste vide si l'API répond 404", async () => {
    mockFetch({ "/categories": { body: [{ slug: "route" }] } });
    await expect(getCategories()).resolves.toEqual([{ slug: "route" }]);
    expect(tags.cacheLife).toHaveBeenCalledWith("hours");
    expect(tags.cacheTag).toHaveBeenCalledWith("catalog");

    vi.restoreAllMocks();
    mockFetch({ "/categories": { status: 404 } });
    await expect(getCategories()).resolves.toEqual([]);
  });

  it("boutiques : liste vide si l'API répond 404", async () => {
    mockFetch({ "/stores": { status: 404 } });
    await expect(getStores()).resolves.toEqual([]);
  });

  it("produits : construit la requête avec les seuls filtres renseignés", async () => {
    const { calls } = mockFetch({
      "/products": { body: { items: [], page: 2, pageSize: 12, total: 0, totalPages: 1 } },
    });
    await getProducts({ page: 2, q: "pulse", categorie: "route", tri: "prix-asc", boutique: "gerland" } as never);
    const url = new URL(calls[0].url);
    expect(url.pathname).toBe("/api/v1/products");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: "2",
      q: "pulse",
      categorie: "route",
      tri: "prix-asc",
      boutique: "gerland",
    });
    expect(tags.cacheLife).toHaveBeenCalledWith("minutes");

    await getProducts({ page: 1 } as never);
    expect(new URL(calls[1].url).search).toBe("?page=1");
  });

  it("produits : page vide par défaut quand l'API répond 404", async () => {
    mockFetch({ "/products": { status: 404 } });
    await expect(getProducts({ page: 3 } as never)).resolves.toEqual({
      items: [],
      page: 3,
      pageSize: 12,
      total: 0,
      totalPages: 1,
    });
  });

  it("fiche produit : slug encodé, étiquette par produit, null si inconnu", async () => {
    const { calls } = mockFetch({ "/products/": { status: 404 } });
    await expect(getProduct("a b/c")).resolves.toBeNull();
    expect(calls[0].url).toContain("/products/a%20b%2Fc");
    expect(tags.cacheTag).toHaveBeenCalledWith("catalog", "product:a b/c");
  });

  it("fiche produit : renvoie le détail", async () => {
    mockFetch({ "/products/pulse-3": { body: { slug: "pulse-3", name: "Pulse 3" } } });
    await expect(getProduct("pulse-3")).resolves.toEqual({ slug: "pulse-3", name: "Pulse 3" });
  });
});
