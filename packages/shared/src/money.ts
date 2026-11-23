const formatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** 13990 -> "139,90 €" */
export function formatPrice(cents: number): string {
  return formatter.format(cents / 100);
}
