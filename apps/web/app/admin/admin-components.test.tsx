import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminOrderDto, AdminProductDetailDto, ApiKeyDto } from "@lafoulee/shared";
import { mockFetch } from "@/test-utils/fetch-mock";
import { ApiKeysManager } from "./cles-api/api-keys-manager";
import { OrderActions } from "./commandes/order-actions";
import { StockGrid } from "./produits/[id]/stock-grid";

// jsdom ne gère pas <dialog> : comportement minimal du navigateur.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false;
};

const order: AdminOrderDto = {
  id: "11111111-1111-1111-1111-111111111111",
  number: 1042,
  status: "PAID",
  fulfillment: "PICKUP",
  pickupStoreName: "La Foulée Gerland",
  subtotalCents: 5000,
  shippingCents: 0,
  totalCents: 5000,
  createdAt: new Date().toISOString(),
  lines: [],
  customerEmail: "lea@exemple.fr",
  shippingAddress: null,
  nextStatuses: ["READY_FOR_PICKUP"],
  refundable: true,
};

describe("OrderActions (EA05)", () => {
  it("change le statut selon les transitions autorisées", async () => {
    const { calls } = mockFetch({ [`/admin/orders/${order.id}/status`]: { body: order } });
    const user = userEvent.setup();
    render(<OrderActions order={order} />);
    expect(screen.queryByRole("button", { name: /expédiée/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Marquer prête/ }));
    expect(calls[0]!.init?.method).toBe("PATCH");
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ status: "READY_FOR_PICKUP" });
  });

  it("TF14 le remboursement demande une confirmation explicite", async () => {
    const { calls } = mockFetch({ [`/admin/orders/${order.id}/refund`]: { status: 201, body: order } });
    const user = userEvent.setup();
    render(<OrderActions order={order} />);
    await user.click(screen.getByRole("button", { name: "Rembourser" }));
    expect(calls).toHaveLength(0);
    expect(screen.getByRole("heading", { name: /Rembourser la commande n°1042/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmer le remboursement" }));
    expect(calls[0]!.url).toContain("/refund");
  });

  it("commande terminée et non remboursable : aucune action", () => {
    const { container } = render(
      <OrderActions order={{ ...order, status: "REFUNDED", nextStatuses: [], refundable: false }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ApiKeysManager (EA07)", () => {
  const existing: ApiKeyDto = {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Club de Lyon",
    prefix: "abcd1234",
    scopes: ["catalog:read"],
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    revokedAt: null,
  };

  it("la clé créée est affichée une seule fois, avec un avertissement", async () => {
    mockFetch({ "/admin/api-keys": { status: 201, body: { ...existing, key: "lf_live_abcd1234_secret" } } });
    const user = userEvent.setup();
    render(<ApiKeysManager keys={[existing]} />);
    await user.type(screen.getByLabelText("Partenaire"), "Office de tourisme");
    await user.click(screen.getByRole("button", { name: "Créer la clé" }));
    expect(await screen.findByText("lf_live_abcd1234_secret")).toBeInTheDocument();
    expect(screen.getByText(/ne sera plus affichée/)).toBeInTheDocument();
  });

  it("aucun droit coché : message, aucune requête", async () => {
    const { calls } = mockFetch({});
    const user = userEvent.setup();
    render(<ApiKeysManager keys={[]} />);
    await user.type(screen.getByLabelText("Partenaire"), "Club");
    await user.click(screen.getByRole("checkbox", { name: /Lire le catalogue/ }));
    await user.click(screen.getByRole("button", { name: "Créer la clé" }));
    expect(screen.getByRole("alert")).toHaveTextContent("au moins un droit");
    expect(calls).toHaveLength(0);
  });

  it("révocation après confirmation", async () => {
    const { calls } = mockFetch({
      [`/admin/api-keys/${existing.id}`]: { body: { ...existing, revokedAt: new Date().toISOString() } },
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<ApiKeysManager keys={[existing]} />);
    await user.click(screen.getByRole("button", { name: /Révoquer la clé Club de Lyon/ }));
    expect(calls[0]!.init?.method).toBe("DELETE");
  });
});

describe("StockGrid (EA04)", () => {
  const product: AdminProductDetailDto = {
    id: "p1",
    slug: "p",
    name: "Pulse 3",
    brand: "Altivo",
    shortDescription: "",
    description: "",
    priceCents: 12990,
    status: "PUBLISHED",
    categorySlugs: ["chaussures-route"],
    images: [],
    stores: [{ slug: "gerland", name: "La Foulée Gerland" }],
    variants: [
      {
        id: "v1",
        size: "42",
        color: "Bleu",
        stocks: [{ storeSlug: "gerland", quantity: 3, reserved: 1, alertThreshold: 2 }],
      },
    ],
  };

  it("un stock modifié est enregistré en quittant le champ ; le réservé est annoncé", async () => {
    const { calls } = mockFetch({ "/admin/stocks": { body: { status: "OK" } } });
    const user = userEvent.setup();
    render(<StockGrid product={product} />);
    const input = screen.getByLabelText("Stock 42 Bleu à La Foulée Gerland");
    expect(input).toHaveAccessibleDescription("dont 1 réservé");
    await user.clear(input);
    await user.type(input, "7");
    await user.tab();
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ variantId: "v1", storeSlug: "gerland", quantity: 7 });
    expect(await screen.findByText("Stock enregistré.")).toBeInTheDocument();
  });

  it("valeur invalide : message, aucune requête", async () => {
    const { calls } = mockFetch({});
    const user = userEvent.setup();
    render(<StockGrid product={product} />);
    const input = screen.getByLabelText("Stock 42 Bleu à La Foulée Gerland");
    await user.clear(input);
    await user.type(input, "2.5");
    await user.tab();
    expect(screen.getByRole("alert")).toHaveTextContent("nombre entier");
    expect(calls).toHaveLength(0);
  });

  it("le seuil d'alerte se modifie et s'enregistre avec le stock actuel", async () => {
    const { calls } = mockFetch({ "/admin/stocks": { body: { status: "OK" } } });
    const user = userEvent.setup();
    render(<StockGrid product={product} />);
    const seuil = screen.getByLabelText(/Seuil d'alerte 42 Bleu à La Foulée Gerland/);
    expect(seuil).toHaveValue(2);
    await user.clear(seuil);
    await user.type(seuil, "5");
    await user.tab();
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({
      variantId: "v1",
      storeSlug: "gerland",
      quantity: 3,
      alertThreshold: 5,
    });
    expect(await screen.findByText("Seuil d'alerte enregistré.")).toBeInTheDocument();
  });
});
