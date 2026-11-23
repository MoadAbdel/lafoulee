import { render, screen } from "@testing-library/react";
import type { OrderDto } from "@lafoulee/shared";
import { mockFetch } from "@/test-utils/fetch-mock";
import { confirmationUrl } from "../payment-step";
import { OrderConfirmation } from "./order-confirmation";

vi.mock("@stripe/react-stripe-js", () => ({}));
vi.mock("@stripe/stripe-js", () => ({ loadStripe: vi.fn() }));

const TOKEN = "j".repeat(43);
const order = (status: OrderDto["status"]): OrderDto => ({
  id: "o1",
  number: 1042,
  status,
  fulfillment: "PICKUP",
  pickupStoreName: "La Foulée Gerland",
  subtotalCents: 5000,
  shippingCents: 0,
  totalCents: 5000,
  createdAt: new Date().toISOString(),
  lines: [{ productName: "Altivo Pulse 3", variantLabel: "42, Bleu", unitPriceCents: 2500, quantity: 2 }],
});

describe("OrderConfirmation", () => {
  beforeEach(() => window.history.replaceState(null, "", `/commande/confirmation?commande=o1&jeton=${TOKEN}`));

  it("URL de retour Stripe : identifiant et jeton de suivi", () => {
    expect(confirmationUrl({ orderId: "o1", accessToken: TOKEN }, "https://lafoulee.vercel.app")).toBe(
      `https://lafoulee.vercel.app/commande/confirmation?commande=o1&jeton=${TOKEN}`,
    );
  });

  it("commande payée : message de remerciement et panier vidé", async () => {
    const { calls } = mockFetch({ "/api/v1/orders/o1": { body: order("PAID") }, "/api/v1/cart": { status: 204 } });
    render(<OrderConfirmation />);
    expect(await screen.findByText(/commande n°1042 est payée/)).toBeInTheDocument();
    expect(screen.getByText(/Retrait gratuit à La Foulée Gerland/)).toBeInTheDocument();
    await vi.waitFor(() => expect(calls.some((call) => call.init?.method === "DELETE")).toBe(true));
  });

  it("paiement en cours : nouvelle vérification jusqu'à la confirmation", async () => {
    let n = 0;
    mockFetch({
      "/api/v1/orders/o1": () => ({ body: order(++n < 2 ? "PENDING" : "PAID") }),
      "/api/v1/cart": { status: 204 },
    });
    render(<OrderConfirmation />);
    expect(await screen.findByText("Paiement en cours de confirmation...")).toBeInTheDocument();
    expect(await screen.findByText(/est payée/, {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it("jeton invalide : commande introuvable ; lien incomplet : message", async () => {
    mockFetch({ "/api/v1/orders/o1": { status: 404 } });
    const { unmount } = render(<OrderConfirmation />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Commande introuvable");
    unmount();
    window.history.replaceState(null, "", "/commande/confirmation");
    render(<OrderConfirmation />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Lien de suivi incomplet");
  });
});
