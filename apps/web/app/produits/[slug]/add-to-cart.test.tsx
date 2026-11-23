import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockFetch } from "@/test-utils/fetch-mock";
import { CartBadge } from "@/components/cart-badge";
import { AddToCart } from "./add-to-cart";

const cartWith = (quantity: number) => ({
  lines: quantity ? [{ variantId: "v1", quantity }] : [],
  itemCount: quantity,
  subtotalCents: 0,
});

describe("AddToCart et compteur du panier", () => {
  it("sans taille choisie : bouton désactivé", () => {
    render(<AddToCart variantId={null} disabled />);
    expect(screen.getByRole("button", { name: "Choisissez une taille" })).toBeDisabled();
  });

  it("ajoute une unité à la quantité existante et met à jour le compteur", async () => {
    let quantity = 1;
    const { calls } = mockFetch({
      "/api/v1/cart/items": (_url, init) => {
        quantity = (JSON.parse(String(init?.body)) as { quantity: number }).quantity;
        return { body: cartWith(quantity) };
      },
      "/api/v1/cart": () => ({ body: cartWith(quantity) }),
    });
    const user = userEvent.setup();
    render(
      <>
        <CartBadge />
        <AddToCart variantId="v1" disabled={false} />
      </>,
    );
    expect(await screen.findByText("1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ajouter au panier" }));
    expect(await screen.findByText(/Article ajouté/)).toBeInTheDocument();
    expect(JSON.parse(String(calls.find((call) => call.init?.method === "PUT")!.init?.body))).toEqual({
      variantId: "v1",
      quantity: 2,
    });
    expect(await screen.findByText("2")).toBeInTheDocument();
  });

  it("rupture entre-temps : message de l'API", async () => {
    mockFetch({
      "/api/v1/cart/items": { status: 400, body: { message: "Cette taille est en rupture de stock." } },
      "/api/v1/cart": { body: cartWith(0) },
    });
    const user = userEvent.setup();
    render(<AddToCart variantId="v1" disabled={false} />);
    await user.click(screen.getByRole("button", { name: "Ajouter au panier" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("rupture");
  });
});
