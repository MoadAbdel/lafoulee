import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CreateOrderResult } from "@lafoulee/shared";
import { confirmationUrl, PaymentStep } from "./payment-step";

const stripe = vi.hoisted(() => ({
  confirmPayment: vi.fn(),
  useStripe: vi.fn(),
  elementsOptions: vi.fn(),
}));

vi.mock("@stripe/stripe-js", () => ({ loadStripe: vi.fn(async () => ({})) }));
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children, options }: { children: React.ReactNode; options: unknown }) => {
    stripe.elementsOptions(options);
    return <div>{children}</div>;
  },
  PaymentElement: () => <div>Cadre de paiement Stripe</div>,
  useStripe: stripe.useStripe,
  useElements: () => ({ id: "elements" }),
}));

const order = {
  orderId: "o1",
  number: 1042,
  accessToken: "t".repeat(43),
  clientSecret: "pi_1_secret_x",
  totalCents: 12990,
} as CreateOrderResult;

beforeEach(() => {
  stripe.confirmPayment.mockReset();
  stripe.elementsOptions.mockReset();
  stripe.useStripe.mockReturnValue({ confirmPayment: stripe.confirmPayment });
});

describe("confirmationUrl", () => {
  it("contient la commande et le jeton d'accès, encodés", () => {
    const url = new URL(confirmationUrl({ orderId: "o 1", accessToken: "a+b/c" }, "https://lafoulee.fr"));
    expect(url.origin + url.pathname).toBe("https://lafoulee.fr/commande/confirmation");
    expect(url.searchParams.get("commande")).toBe("o 1");
    expect(url.searchParams.get("jeton")).toBe("a+b/c");
  });
});

describe("PaymentStep (Stripe)", () => {
  it("configure Stripe avec le secret du paiement, en français, et affiche le montant", () => {
    render(<PaymentStep order={order} />);
    expect(stripe.elementsOptions).toHaveBeenCalledWith(
      expect.objectContaining({ clientSecret: "pi_1_secret_x", locale: "fr" }),
    );
    expect(screen.getByText(/Commande n°1042/)).toBeInTheDocument();
    expect(screen.getByText("Cadre de paiement Stripe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Payer .*129,90/ })).toBeEnabled();
  });

  it("bouton désactivé tant que Stripe n'est pas chargé, et aucun paiement lancé", async () => {
    stripe.useStripe.mockReturnValue(null);
    render(<PaymentStep order={order} />);
    const button = screen.getByRole("button", { name: /Payer/ });
    expect(button).toBeDisabled();
    await userEvent.setup().click(button);
    expect(stripe.confirmPayment).not.toHaveBeenCalled();
  });

  it("paiement : envoie l'URL de retour avec la commande et le jeton", async () => {
    stripe.confirmPayment.mockResolvedValue({ error: { message: "Carte refusée." } });
    const user = userEvent.setup();
    render(<PaymentStep order={order} />);
    await user.click(screen.getByRole("button", { name: /Payer/ }));
    const args = stripe.confirmPayment.mock.calls[0][0] as { confirmParams: { return_url: string } };
    const returnUrl = new URL(args.confirmParams.return_url);
    expect(returnUrl.pathname).toBe("/commande/confirmation");
    expect(returnUrl.searchParams.get("commande")).toBe("o1");
    expect(returnUrl.searchParams.get("jeton")).toBe("t".repeat(43));
  });

  it("erreur Stripe : message affiché et bouton de nouveau actif", async () => {
    stripe.confirmPayment.mockResolvedValue({ error: { message: "Carte refusée." } });
    const user = userEvent.setup();
    render(<PaymentStep order={order} />);
    await user.click(screen.getByRole("button", { name: /Payer/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Carte refusée.");
    expect(screen.getByRole("button", { name: /Payer/ })).toBeEnabled();
  });

  it("erreur sans message : texte par défaut", async () => {
    stripe.confirmPayment.mockResolvedValue({ error: {} });
    const user = userEvent.setup();
    render(<PaymentStep order={order} />);
    await user.click(screen.getByRole("button", { name: /Payer/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Le paiement n'a pas abouti");
  });
});
