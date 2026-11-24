import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { StoreDto, VariantDto } from "@lafoulee/shared";
import { ColorProvider, ProductImageByColor } from "./color-context";
import { VariantPicker } from "./variant-picker";

const variant = (id: string, color: string): VariantDto =>
  ({ id, size: "42", color, priceCents: 15000, totalAvailable: 2, stocks: [] }) as unknown as VariantDto;
const product = {
  brand: "Essai",
  name: "Pulse",
  images: [
    { url: "/catalogue/pulse.jpg", alt: "Pulse blanc", color: "Blanc" },
    { url: "/catalogue/pulse-noir.jpg", alt: "Pulse noir", color: "Noir" },
  ],
};

describe("fiche produit : photo du coloris choisi", () => {
  it("la photo suit le coloris ; un coloris sans photo garde la photo principale", async () => {
    const user = userEvent.setup();
    render(
      <ColorProvider initial="Blanc">
        <ProductImageByColor product={product} />
        <VariantPicker
          variants={[variant("a", "Blanc"), variant("b", "Noir"), variant("c", "Vert")]}
          stores={[] as StoreDto[]}
        />
      </ColorProvider>,
    );
    expect(screen.getByRole("img")).toHaveAttribute("alt", "Pulse blanc");
    await user.click(screen.getByRole("radio", { name: "Noir" }));
    expect(screen.getByRole("img")).toHaveAttribute("alt", "Pulse noir");
    await user.click(screen.getByRole("radio", { name: "Vert" }));
    expect(screen.getByRole("img")).toHaveAttribute("alt", "Pulse blanc");
  });
});
