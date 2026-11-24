import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { slugify, type AdminCategoryDto, type AdminProductDetailDto } from "@lafoulee/shared";
import { mockFetch } from "@/test-utils/fetch-mock";
import { CategoryManager } from "./categories/category-manager";
import { parsePriceCents } from "./produits/catalog-fields";
import { ImageManager } from "./produits/[id]/image-manager";
import { ProductEditor } from "./produits/[id]/product-editor";
import { VariantForm } from "./produits/[id]/variant-form";
import { NewProductForm } from "./produits/nouveau/new-product-form";

const categories: AdminCategoryDto[] = [
  {
    id: "c1",
    slug: "chaussures-route",
    name: "Chaussures de route",
    description: "Route",
    position: 0,
    productCount: 4,
  },
  { id: "c2", slug: "nutrition", name: "Nutrition", description: "Gels", position: 1, productCount: 0 },
];

const product: AdminProductDetailDto = {
  id: "p1",
  slug: "altivo-pulse-3",
  name: "Pulse 3",
  brand: "Altivo",
  shortDescription: "Polyvalente",
  description: "Chaussure de route.",
  priceCents: 12990,
  status: "DRAFT",
  categorySlugs: ["chaussures-route"],
  images: [{ id: "i1", url: "https://x.public.blob.vercel-storage.com/a.png", alt: "Vue de profil" }],
  stores: [],
  variants: [],
};

const body = (call: { init?: RequestInit } | undefined) => JSON.parse(String(call?.init?.body)) as unknown;

describe("slugify", () => {
  it("accents retirés, tirets uniques, 80 caractères au plus, rapide sur une chaîne de tirets", () => {
    expect(slugify("Gel Énergie Café !")).toBe("gel-energie-cafe");
    expect(slugify("--Trail--  Été--")).toBe("trail-ete");
    expect(slugify("mot ".repeat(40)).length).toBeLessThanOrEqual(80);
    const start = performance.now();
    slugify(`${"-".repeat(100_000)}!`);
    expect(performance.now() - start).toBeLessThan(200);
  });
});

describe("parsePriceCents", () => {
  it("accepte la virgule ou le point, refuse le reste", () => {
    expect(parsePriceCents("119,90")).toBe(11990);
    expect(parsePriceCents("12.5")).toBe(1250);
    expect(parsePriceCents("12,345")).toBeNaN();
    expect(parsePriceCents("abc")).toBeNaN();
  });
});

describe("NewProductForm (EA03)", () => {
  it("champs manquants : messages, aucun appel ; formulaire complet : produit créé", async () => {
    const { calls } = mockFetch({ "/admin/products": { status: 201, body: { ...product, id: "nouveau" } } });
    const user = userEvent.setup();
    render(<NewProductForm categories={categories} />);
    await user.click(screen.getByRole("button", { name: "Créer le produit en brouillon" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choisissez au moins une catégorie.");
    expect(calls).toHaveLength(0);

    await user.type(screen.getByLabelText("Marque"), "Altivo");
    await user.type(screen.getByLabelText("Nom"), "Pulse 4");
    await user.type(screen.getByLabelText("Prix (euros)"), "139,90");
    await user.type(screen.getByLabelText(/Accroche/), "Légère");
    await user.type(screen.getByLabelText("Description"), "La suite de la Pulse 3.");
    await user.click(screen.getByRole("checkbox", { name: "Chaussures de route" }));
    await user.click(screen.getByRole("button", { name: "Créer le produit en brouillon" }));
    expect(body(calls[0])).toEqual({
      brand: "Altivo",
      name: "Pulse 4",
      priceCents: 13990,
      shortDescription: "Légère",
      description: "La suite de la Pulse 3.",
      categorySlugs: ["chaussures-route"],
    });
  });
});

describe("ProductEditor (EA03)", () => {
  it("seul le changement de catégories est envoyé", async () => {
    const { calls } = mockFetch({ "/admin/products/p1": { body: product } });
    const user = userEvent.setup();
    render(<ProductEditor product={product} categories={categories} />);
    await user.click(screen.getByRole("checkbox", { name: "Nutrition" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(body(calls[0])).toEqual({ categorySlugs: ["chaussures-route", "nutrition"] });
    expect(await screen.findByText("Modifications enregistrées.")).toBeInTheDocument();
  });
});

describe("VariantForm (EA03)", () => {
  it("taille et coloris obligatoires ; ajout confirmé", async () => {
    const { calls } = mockFetch({ "/admin/products/p1/variants": { status: 201, body: product } });
    const user = userEvent.setup();
    render(<VariantForm productId="p1" />);
    await user.click(screen.getByRole("button", { name: "Ajouter" }));
    expect(screen.getByRole("alert")).toHaveTextContent("La taille est obligatoire.");
    await user.type(screen.getByLabelText("Taille"), "43");
    await user.type(screen.getByLabelText("Coloris"), "Noir");
    await user.click(screen.getByRole("button", { name: "Ajouter" }));
    expect(body(calls[0])).toEqual({ size: "43", color: "Noir" });
    expect(await screen.findByRole("status")).toHaveTextContent("Taille 43 (Noir) ajoutée.");
  });
});

describe("ImageManager (EA03)", () => {
  it("texte alternatif obligatoire ; envoi binaire avec le bon type ; suppression", async () => {
    const { calls } = mockFetch({ "/admin/products/p1/images": { status: 201, body: product } });
    const user = userEvent.setup();
    render(<ImageManager product={product} />);
    expect(screen.getByRole("img", { name: "Vue de profil" })).toBeInTheDocument();

    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "face.png", { type: "image/png" });
    await user.upload(screen.getByLabelText(/Photo \(JPEG/), file);
    await user.click(screen.getByRole("button", { name: "Ajouter la photo" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Décrivez l'image");
    expect(calls).toHaveLength(0);

    await user.type(screen.getByLabelText(/Description de la photo/), "Vue de face");
    await user.click(screen.getByRole("button", { name: "Ajouter la photo" }));
    expect(calls[0]!.url).toContain("/admin/products/p1/images?alt=Vue+de+face");
    expect(new Headers(calls[0]!.init?.headers).get("content-type")).toBe("image/png");
    expect(calls[0]!.init?.body).toBe(file);

    await user.click(screen.getByRole("button", { name: "Supprimer la photo : Vue de profil" }));
    expect(calls[1]!.init?.method).toBe("DELETE");
    expect(calls[1]!.url).toContain("/admin/products/p1/images/i1");
  });
});

describe("CategoryManager (EA03)", () => {
  it("création ; catégorie non vide : suppression désactivée", async () => {
    const { calls } = mockFetch({ "/admin/categories": { status: 201, body: { ...categories[1], name: "Récup" } } });
    const user = userEvent.setup();
    render(<CategoryManager categories={categories} />);
    expect(screen.getByRole("button", { name: "Supprimer la catégorie Chaussures de route" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Supprimer la catégorie Nutrition" })).toBeEnabled();

    await user.type(screen.getByLabelText("Nom", { selector: "#new-category-name" }), "Récup");
    await user.type(screen.getByLabelText("Description", { selector: "#new-category-description" }), "Rouleaux");
    await user.click(screen.getByRole("button", { name: "Créer la catégorie" }));
    expect(body(calls[0])).toEqual({ name: "Récup", description: "Rouleaux", position: 2 });
    expect(await screen.findByRole("status")).toHaveTextContent('Catégorie "Récup" créée.');
  });
});
