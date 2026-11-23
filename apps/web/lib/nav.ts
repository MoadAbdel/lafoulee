/**
 * Navigation principale. Les catégories sont fixes (le gérant ne les modifie pas
 * en ligne) : l'en-tête reste donc entièrement statique, sans appel à l'API.
 */
export const MAIN_NAV = [
  { href: "/produits?categorie=chaussures-route", label: "Route" },
  { href: "/produits?categorie=chaussures-trail", label: "Trail" },
  { href: "/produits?categorie=textile-femme", label: "Femme" },
  { href: "/produits?categorie=textile-homme", label: "Homme" },
  { href: "/produits?categorie=nutrition", label: "Nutrition" },
  { href: "/produits?categorie=accessoires", label: "Accessoires" },
] as const;
