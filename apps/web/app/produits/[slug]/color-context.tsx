"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { ProductDetailDto } from "@lafoulee/shared";
import { ProductVisual } from "@/components/product-visual";

/** Coloris choisi sur la fiche : partagé entre le sélecteur et la photo. */
const ColorContext = createContext<{ color: string; setColor: (color: string) => void } | null>(null);

export function ColorProvider({ initial, children }: { initial: string; children: ReactNode }) {
  const [color, setColor] = useState(initial);
  return <ColorContext.Provider value={{ color, setColor }}>{children}</ColorContext.Provider>;
}

/** Sans fournisseur (tests, autre page), le sélecteur garde son propre état. */
export function useColorContext() {
  return useContext(ColorContext);
}

/** Photo du coloris choisi ; à défaut, la première photo du produit. */
export function ProductImageByColor({ product }: { product: Pick<ProductDetailDto, "brand" | "name" | "images"> }) {
  const color = useContext(ColorContext)?.color;
  const image = product.images.find((item) => item.color === color) ?? product.images[0];
  return (
    <ProductVisual
      key={image?.url}
      brand={product.brand}
      name={product.name}
      imageUrl={image?.url ?? null}
      imageAlt={image?.alt ?? null}
      priority
    />
  );
}
