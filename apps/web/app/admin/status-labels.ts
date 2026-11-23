import type { OrderStatus } from "@lafoulee/shared";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "En attente de paiement",
  PAID: "Payée, à préparer",
  READY_FOR_PICKUP: "Prête en boutique",
  SHIPPED: "Expédiée",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
};

export const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  READY_FOR_PICKUP: "Marquer prête (prévient le client)",
  SHIPPED: "Marquer expédiée",
  COMPLETED: "Marquer terminée",
};
