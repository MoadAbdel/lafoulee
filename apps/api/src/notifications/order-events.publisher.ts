import { Injectable, Logger } from "@nestjs/common";
import { send } from "@vercel/queue";
import { NotificationsService } from "./notifications.service.js";

export const ORDER_PAID_TOPIC = "order-paid";

/**
 * Publie l'événement "commande payée" (dossier, C10 : adaptateur QueuePublisher).
 * - Sur Vercel : message dans Vercel Queues ; le consommateur envoie l'email,
 *   avec de nouveaux essais automatiques. Le paiement n'attend pas l'email.
 * - En local, en CI, ou si la file est indisponible : envoi direct.
 * Un échec d'email ne remet jamais en cause un paiement validé.
 */
@Injectable()
export class OrderEventsPublisher {
  private readonly logger = new Logger(OrderEventsPublisher.name);

  constructor(private readonly notifications: NotificationsService) {}

  async orderPaid(orderId: string): Promise<void> {
    if (process.env.VERCEL) {
      try {
        await send(ORDER_PAID_TOPIC, { orderId }, { idempotencyKey: `order-paid-${orderId}` });
        return;
      } catch (error) {
        this.logger.warn(`File indisponible, envoi direct de la confirmation ${orderId} : ${String(error)}`);
      }
    }
    try {
      await this.notifications.sendOrderConfirmation(orderId);
    } catch (error) {
      this.logger.error(`Confirmation non envoyée pour la commande ${orderId} : ${String(error)}`);
    }
  }
}
