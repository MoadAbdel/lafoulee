import { ConflictException, Injectable } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client.js";

type Tx = Prisma.TransactionClient;

export interface Allocation {
  variantId: string;
  storeId: string;
  quantity: number;
}

export interface StockNeed {
  variantId: string;
  quantity: number;
  label: string;
}

/**
 * Opérations de stock, toujours dans une transaction (dossier, RG1).
 * La réservation est une mise à jour conditionnelle : deux commandes simultanées
 * sur la dernière paire ne peuvent pas réussir toutes les deux.
 */
@Injectable()
export class StockService {
  /**
   * Retrait : tout dans la boutique choisie. Livraison : depuis les boutiques
   * qui ont le plus de stock, quitte à répartir une ligne sur plusieurs boutiques.
   */
  async reserve(tx: Tx, needs: StockNeed[], pickupStoreId: string | null): Promise<Allocation[]> {
    const allocations: Allocation[] = [];
    for (const need of needs) {
      const stocks = await tx.stock.findMany({
        where: { variantId: need.variantId, ...(pickupStoreId ? { storeId: pickupStoreId } : {}) },
      });
      const candidates = stocks
        .map((stock) => ({ storeId: stock.storeId, available: stock.quantity - stock.reserved }))
        .filter((stock) => stock.available > 0)
        .sort((a, b) => b.available - a.available);

      let remaining = need.quantity;
      for (const candidate of candidates) {
        if (remaining === 0) break;
        const take = Math.min(remaining, candidate.available);
        const updated = await tx.$executeRaw`
          UPDATE stocks SET reserved = reserved + ${take}
          WHERE variant_id = ${need.variantId}::uuid AND store_id = ${candidate.storeId}::uuid
            AND quantity - reserved >= ${take}`;
        if (updated === 1) {
          allocations.push({ variantId: need.variantId, storeId: candidate.storeId, quantity: take });
          remaining -= take;
        }
      }
      if (remaining > 0) {
        throw new ConflictException({
          statusCode: 409,
          code: "OUT_OF_STOCK",
          message: pickupStoreId
            ? `Stock insuffisant dans cette boutique pour : ${need.label}.`
            : `Stock insuffisant pour : ${need.label}.`,
        });
      }
    }
    return allocations;
  }

  /** Paiement confirmé : la réservation devient une sortie de stock. */
  async commit(tx: Tx, allocations: Allocation[]): Promise<void> {
    for (const a of allocations) {
      await tx.$executeRaw`
        UPDATE stocks SET quantity = quantity - ${a.quantity}, reserved = reserved - ${a.quantity}
        WHERE variant_id = ${a.variantId}::uuid AND store_id = ${a.storeId}::uuid`;
    }
  }

  /** Commande annulée ou expirée : le stock réservé redevient disponible. */
  async release(tx: Tx, allocations: Allocation[]): Promise<void> {
    for (const a of allocations) {
      await tx.$executeRaw`
        UPDATE stocks SET reserved = GREATEST(0, reserved - ${a.quantity})
        WHERE variant_id = ${a.variantId}::uuid AND store_id = ${a.storeId}::uuid`;
    }
  }
}
