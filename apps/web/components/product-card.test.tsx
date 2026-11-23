import { render, screen } from "@testing-library/react";
import type { ProductCardDto } from "@lafoulee/shared";
import { ProductCard } from "./product-card";

const product: ProductCardDto = {
  slug: "altivo-pulse-3",
  name: "Pulse 3",
  brand: "Altivo",
  shortDescription: "Chaussure d'entraînement polyvalente.",
  fromPriceCents: 12990,
  inStock: true,
  imageUrl: null,
  imageAlt: null,
};

describe("ProductCard", () => {
  it("un seul lien, vers la fiche, avec le nom du produit", () => {
    render(<ProductCard product={product} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/produits/altivo-pulse-3");
    expect(links[0]).toHaveAccessibleName("Pulse 3");
  });

  it("affiche le prix de départ au format français", () => {
    render(<ProductCard product={product} />);
    expect(screen.getByText(/à partir de 129,90/)).toBeInTheDocument();
  });

  it("indique la rupture de stock", () => {
    render(<ProductCard product={{ ...product, inStock: false }} />);
    expect(screen.getByText("Rupture de stock")).toBeInTheDocument();
  });
});
