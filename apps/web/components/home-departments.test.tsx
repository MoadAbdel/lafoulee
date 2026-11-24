import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogSummary, Departments } from "./home-departments";

vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("@/lib/catalog", () => ({ getCategories: vi.fn(), getProducts: vi.fn() }));
const catalog = await import("@/lib/catalog");

const product = (slug: string, imageUrl: string | null) => ({ slug, name: slug, imageUrl, imageAlt: null });

describe("accueil : grille des rayons", () => {
  beforeEach(() => {
    vi.mocked(catalog.getCategories).mockResolvedValue([
      { slug: "chaussures-route", name: "Chaussures de route", description: "" },
      { slug: "nutrition", name: "Nutrition", description: "" },
    ]);
    vi.mocked(catalog.getProducts).mockImplementation(async (query) => {
      const items =
        query.categorie === "nutrition"
          ? [product("gel", null)]
          : [product("sans-photo", null), product("ghost", "/catalogue/ghost.jpg")];
      return { items, total: query.categorie ? items.length : 40, page: 1, totalPages: 1 } as never;
    });
  });

  it("un lien par rayon, avec le nombre de produits et la première photo disponible", async () => {
    const { container } = render(await Departments());
    const route = screen.getByRole("link", { name: /Chaussures de route\s*2 produits/ });
    expect(route).toHaveAttribute("href", "/produits?categorie=chaussures-route");
    expect(screen.getByRole("link", { name: /Nutrition\s*1 produits/ })).toBeInTheDocument();
    // Rayon sans aucune photo : pas d'image vide.
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Trouver ma boutique/ })).toHaveAttribute("href", "/boutiques");
  });

  it("le résumé donne le nombre total de modèles", async () => {
    render(await CatalogSummary());
    expect(screen.getByText(/40 modèles en stock/)).toBeInTheDocument();
  });
});
