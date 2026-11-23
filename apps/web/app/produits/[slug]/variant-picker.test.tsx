import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { StoreDto, VariantDto } from "@lafoulee/shared";
import { VariantPicker } from "./variant-picker";

const stores: StoreDto[] = [
  {
    slug: "croix-rousse",
    name: "La Foulée Croix-Rousse",
    address: "",
    postalCode: "69004",
    city: "Lyon",
    openingHours: "",
  },
  { slug: "gerland", name: "La Foulée Gerland", address: "", postalCode: "69007", city: "Lyon", openingHours: "" },
];

function variant(id: string, size: string, color: string, stock: [number, number]): VariantDto {
  return {
    id,
    sku: id,
    size,
    color,
    priceCents: 13990,
    stocks: [
      { storeSlug: "croix-rousse", available: stock[0] },
      { storeSlug: "gerland", available: stock[1] },
    ],
    totalAvailable: stock[0] + stock[1],
  };
}

const variants = [
  variant("v1", "41", "Bleu nuit", [2, 0]),
  variant("v2", "42", "Bleu nuit", [0, 0]),
  variant("v3", "42", "Orange", [0, 3]),
];

describe("VariantPicker (EF03)", () => {
  it("TF03 une pointure en rupture partout est barrée et non sélectionnable", () => {
    render(<VariantPicker variants={variants} stores={stores} />);
    const soldOut = screen.getByRole("radio", { name: /42 \(rupture\)/ });
    expect(soldOut).toBeDisabled();
    expect(screen.getByRole("radio", { name: "41" })).toBeEnabled();
  });

  it("affiche le stock par boutique de la pointure choisie", async () => {
    const user = userEvent.setup();
    render(<VariantPicker variants={variants} stores={stores} />);
    expect(screen.getByText(/Choisissez une taille/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "41" }));
    expect(screen.getByText("2 en stock")).toBeInTheDocument();
    expect(screen.getByText("Indisponible")).toBeInTheDocument();
  });

  it("changer de coloris réinitialise la pointure et filtre les tailles", async () => {
    const user = userEvent.setup();
    render(<VariantPicker variants={variants} stores={stores} />);
    await user.click(screen.getByRole("radio", { name: "41" }));
    await user.click(screen.getByRole("radio", { name: "Orange" }));
    expect(screen.queryByRole("radio", { name: "41" })).not.toBeInTheDocument();
    expect(screen.getByText(/Choisissez une taille/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "42" }));
    expect(screen.getByText("3 en stock")).toBeInTheDocument();
  });

  it("se manipule au clavier (boutons radio natifs)", async () => {
    const user = userEvent.setup();
    render(<VariantPicker variants={[variants[0]!]} stores={stores} />);
    await user.tab();
    await user.keyboard(" ");
    expect(screen.getByRole("radio", { name: "41" })).toBeChecked();
  });

  it("parle de taille pour le textile", () => {
    render(<VariantPicker variants={[variant("t1", "M", "Noir", [1, 1])]} stores={stores} />);
    expect(screen.getByRole("group", { name: "Taille" })).toBeInTheDocument();
  });
});
