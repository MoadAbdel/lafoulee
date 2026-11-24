"use client";

import { usePathname } from "next/navigation";

/**
 * Enveloppe de l'en-tête : rouge (affiche) sur l'accueil seulement.
 * La couleur suit l'adresse courante. Un sélecteur CSS sur la page ne suffit pas :
 * Next.js garde la page précédente cachée dans le document après une navigation.
 */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const isHome = usePathname() === "/";
  return (
    <header className={`site-header border-b-[3px] ${isHome ? "is-affiche" : "border-asphalte bg-craie"}`}>
      {children}
    </header>
  );
}
