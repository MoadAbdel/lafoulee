"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CartDto } from "@lafoulee/shared";
import { CART_EVENT, getJson } from "@/lib/client-api";

/** Lien vers le panier avec le nombre d'articles (l'en-tête reste statique, seul ce lien se met à jour). */
export function CartBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      void getJson<CartDto>("/cart").then((result) => {
        if (result.ok) setCount(result.data.itemCount);
      });
    };
    refresh();
    window.addEventListener(CART_EVENT, refresh);
    return () => window.removeEventListener(CART_EVENT, refresh);
  }, []);

  return (
    <Link href="/panier" className="min-h-11 content-center font-semibold underline-offset-4 hover:underline">
      Panier
      {count > 0 && (
        <span className="ml-1 inline-block min-w-6 bg-balise px-1.5 text-center text-sm text-craie">
          {count}
          <span className="sr-only"> article{count > 1 ? "s" : ""}</span>
        </span>
      )}
    </Link>
  );
}
