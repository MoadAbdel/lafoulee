import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CartDto, CartLineDto } from "@lafoulee/shared";
import { mockFetch } from "@/test-utils/fetch-mock";
import { CartView } from "./cart-view";

const line = (overrides: Partial<CartLineDto> = {}): CartLineDto => ({
  variantId: "v1",
  productSlug: "altivo-pulse-3",
  productName: "Pulse 3",
  brand: "Altivo",
  size: "42",
  color: "Bleu nuit",
  unitPriceCents: 2500,
  quantity: 2,
  lineTotalCents: 5000,
  available: 3,
  ...overrides,
});
const cart = (lines: CartLineDto[]): CartDto => ({
  lines,
  itemCount: lines.reduce((sum, item) => sum + item.quantity, 0),
  subtotalCents: lines.reduce((sum, item) => sum + item.lineTotalCents, 0),
  pickupStoreSlugs: [],
});

describe("CartView (EF04)", () => {
  it("TF04 affiche le total et ce qu'il manque pour la livraison offerte", async () => {
    mockFetch({ "/api/v1/cart": { body: cart([line()]) } });
    render(<CartView />);
    expect(await screen.findByText("50,00 €", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText(/plus que 10,00/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Commander" })).toHaveAttribute("href", "/commande");
  });

  it("TF05 les quantités proposées ne dépassent pas le stock disponible", async () => {
    mockFetch({ "/api/v1/cart": { body: cart([line({ available: 3 })]) } });
    render(<CartView />);
    const select = await screen.findByRole("combobox", { name: /Quantité pour Pulse 3 42/ });
    expect(Array.from((select as HTMLSelectElement).options).map((option) => option.value)).toEqual(["1", "2", "3"]);
  });

  it("changer la quantité ou retirer un article met le panier à jour", async () => {
    const { calls } = mockFetch({
      "/api/v1/cart/items": (_url, init) => {
        const { quantity } = JSON.parse(String(init?.body)) as { quantity: number };
        return { body: cart(quantity === 0 ? [] : [line({ quantity, lineTotalCents: 2500 * quantity })]) };
      },
      "/api/v1/cart": { body: cart([line()]) },
    });
    const user = userEvent.setup();
    const changed = vi.fn();
    window.addEventListener("lafoulee:panier", changed);
    render(<CartView />);
    await user.selectOptions(await screen.findByRole("combobox"), "3");
    expect(await screen.findByText("75,00 €", { selector: "span" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Retirer/ }));
    expect(await screen.findByText("Votre panier est vide.")).toBeInTheDocument();
    expect(calls.filter((call) => call.init?.method === "PUT")).toHaveLength(2);
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it("panier vide : lien vers le catalogue", async () => {
    mockFetch({ "/api/v1/cart": { body: cart([]) } });
    render(<CartView />);
    expect(await screen.findByRole("link", { name: "Voir le catalogue" })).toBeInTheDocument();
  });
});
