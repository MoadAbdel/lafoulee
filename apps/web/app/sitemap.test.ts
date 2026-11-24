import { getCategories, getProducts } from "@/lib/catalog";
import sitemap from "./sitemap";

vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/catalog", () => ({ getCategories: vi.fn(), getProducts: vi.fn() }));

const list = (slugs: string[], page: number, totalPages: number) => ({
  items: slugs.map((slug) => ({ slug })),
  page,
  pageSize: 12,
  total: 0,
  totalPages,
});

beforeEach(() => {
  vi.mocked(getCategories).mockReset();
  vi.mocked(getProducts).mockReset();
});

describe("sitemap.xml", () => {
  it("contient les pages fixes, les catégories et les fiches produits de toutes les pages", async () => {
    vi.mocked(getCategories).mockResolvedValue([{ slug: "route" }, { slug: "trail" }] as never);
    vi.mocked(getProducts).mockImplementation((async ({ page }: { page: number }) =>
      page === 1 ? list(["a", "b"], 1, 2) : list(["c"], 2, 2)) as never);
    const urls = (await sitemap()).map((entry) => new URL(entry.url));
    const paths = urls.map((url) => url.pathname + url.search);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/",
        "/produits",
        "/boutiques",
        "/confidentialite",
        "/mentions-legales",
        "/produits?categorie=route",
        "/produits?categorie=trail",
        "/produits/a",
        "/produits/b",
        "/produits/c",
      ]),
    );
    expect(getProducts).toHaveBeenCalledWith({ page: 2, tri: "nouveautes" });
  });

  it("limite à 50 pages de produits", async () => {
    vi.mocked(getCategories).mockResolvedValue([]);
    vi.mocked(getProducts).mockResolvedValue(list([], 1, 200) as never);
    await sitemap();
    expect(getProducts).toHaveBeenCalledTimes(50);
  });

  it("publie quand même les pages fixes si l'API est indisponible", async () => {
    vi.mocked(getCategories).mockRejectedValue(new Error("API HS"));
    const entries = await sitemap();
    expect(entries).toHaveLength(5);
    expect(entries[0].priority).toBe(1);
  });
});
