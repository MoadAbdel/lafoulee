import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CartDto } from "@lafoulee/shared";
import { mockFetch } from "@/test-utils/fetch-mock";
import { Checkout } from "./checkout";

// Le paiement Stripe est testé à part : ici on vérifie seulement qu'on y arrive.
vi.mock("./payment-step", () => ({ PaymentStep: () => <p>Étape de paiement</p> }));

const cart: CartDto = {
  lines: [
    {
      variantId: "v1",
      productSlug: "p",
      productName: "Pulse 3",
      brand: "Altivo",
      size: "42",
      color: "Bleu",
      unitPriceCents: 2500,
      quantity: 2,
      lineTotalCents: 5000,
      available: 3,
    },
  ],
  itemCount: 2,
  subtotalCents: 5000,
};
const stores = [
  {
    slug: "croix-rousse",
    name: "La Foulée Croix-Rousse",
    address: "42 rue X",
    postalCode: "69004",
    city: "Lyon",
    openingHours: "Mar-Sam",
  },
  {
    slug: "gerland",
    name: "La Foulée Gerland",
    address: "3 av Y",
    postalCode: "69007",
    city: "Lyon",
    openingHours: "Mar-Sam",
  },
];
const created = {
  orderId: "o1",
  number: 1042,
  accessToken: "t".repeat(43),
  clientSecret: "pi_1_secret_x",
  totalCents: 5000,
};

function setup(loggedIn = false) {
  return mockFetch({
    "/api/v1/cart": { body: cart },
    "/api/v1/stores": { body: stores },
    "/api/v1/auth/me": loggedIn
      ? { body: { id: "u1", email: "lea@exemple.fr", firstName: "Léa", role: "CUSTOMER" } }
      : { status: 401 },
    "/api/v1/orders": { status: 201, body: created },
  });
}

describe("Checkout (EF05, EF06)", () => {
  it("TF08 retrait (choix par défaut) : boutique obligatoire, pas d'adresse, port offert", async () => {
    const { calls } = setup();
    const user = userEvent.setup();
    render(<Checkout />);
    await user.selectOptions(await screen.findByLabelText("Boutique de retrait"), "gerland");
    expect(screen.queryByLabelText("Adresse")).not.toBeInTheDocument();
    expect(screen.getByText("Offerts")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Email pour la confirmation"), "lea@exemple.fr");
    await user.click(screen.getByRole("button", { name: "Continuer vers le paiement" }));
    expect(await screen.findByText("Étape de paiement")).toBeInTheDocument();
    const post = calls.find((call) => call.init?.method === "POST")!;
    expect(JSON.parse(String(post.init?.body))).toEqual({
      fulfillment: "PICKUP",
      pickupStoreSlug: "gerland",
      email: "lea@exemple.fr",
    });
  });

  it("visiteur sans email : message, aucune commande créée", async () => {
    const { calls } = setup();
    const user = userEvent.setup();
    render(<Checkout />);
    await user.click(await screen.findByRole("button", { name: "Continuer vers le paiement" }));
    expect(screen.getByRole("alert")).toHaveTextContent("adresse email");
    expect(calls.some((call) => call.init?.method === "POST")).toBe(false);
  });

  it("client connecté : pas de champ email ; livraison sous 60 € : 4,90 € de port et adresse validée", async () => {
    setup(true);
    const user = userEvent.setup();
    render(<Checkout />);
    expect(await screen.findByText("lea@exemple.fr")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email pour la confirmation")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Livraison à domicile" }));
    expect(screen.getByText("4,90 €")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuer vers le paiement" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Code postal à 5 chiffres");
  });

  it("stock épuisé entre-temps : message de l'API affiché", async () => {
    mockFetch({
      "/api/v1/cart": { body: cart },
      "/api/v1/stores": { body: stores },
      "/api/v1/auth/me": { status: 401 },
      "/api/v1/orders": {
        status: 409,
        body: { code: "OUT_OF_STOCK", message: "Stock insuffisant pour : Pulse 3 (42, Bleu)." },
      },
    });
    const user = userEvent.setup();
    render(<Checkout />);
    await user.type(await screen.findByLabelText("Email pour la confirmation"), "lea@exemple.fr");
    await user.click(screen.getByRole("button", { name: "Continuer vers le paiement" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Stock insuffisant");
  });
});
