import { Inject, Injectable, Logger } from "@nestjs/common";
import { formatPrice } from "@lafoulee/shared";
import { ENV, type Env } from "../config/env.js";
import { MailService } from "../mail/mail.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(ENV) private readonly config: Env,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Email de confirmation (EF07). La file livre "au moins une fois" : on marque
   * l'envoi par une mise à jour conditionnelle, pour n'envoyer qu'un seul email.
   * En cas d'échec, la marque est retirée et l'erreur remonte (nouvel essai de la file).
   */
  async sendOrderConfirmation(orderId: string): Promise<"sent" | "already-sent"> {
    const { count } = await this.prisma.order.updateMany({
      where: { id: orderId, status: { not: "PENDING" }, confirmationSentAt: null },
      data: { confirmationSentAt: new Date() },
    });
    if (count === 0) return "already-sent";

    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { lines: true, pickupStore: true, user: true },
    });
    const to = order.user?.email ?? order.guestEmail;
    if (!to) {
      this.logger.warn(`Commande ${order.number} sans email de contact.`);
      return "already-sent";
    }

    const lines = order.lines.map(
      (line) =>
        `${line.quantity} x ${line.productName} (${line.variantLabel}) : ${formatPrice(line.unitPriceCents * line.quantity)}`,
    );
    const where = order.pickupStore
      ? `Retrait gratuit à ${order.pickupStore.name}, ${order.pickupStore.address}. Nous vous prévenons dès que votre commande est prête.`
      : "Livraison à l'adresse indiquée. Vous recevrez un email à l'expédition.";
    try {
      await this.mail.send({
        to,
        subject: `Commande n°${order.number} confirmée`,
        text: `Bonjour,\n\nMerci pour votre commande n°${order.number}.\n\n${lines.join("\n")}\nFrais de port : ${formatPrice(order.shippingCents)}\nTotal payé : ${formatPrice(order.totalCents)}\n\n${where}\n\nLa Foulée`,
        html: `<p>Bonjour,</p><p>Merci pour votre commande n°${order.number}.</p><ul>${lines
          .map((line) => `<li>${escape(line)}</li>`)
          .join("")}</ul><p>Frais de port : ${formatPrice(order.shippingCents)}<br><strong>Total payé : ${formatPrice(
          order.totalCents,
        )}</strong></p><p>${escape(where)}</p><p><a href="${this.config.APP_ORIGIN}/compte">Suivre mes commandes</a></p>`,
      });
      return "sent";
    } catch (error) {
      await this.prisma.order.update({ where: { id: orderId }, data: { confirmationSentAt: null } });
      throw error;
    }
  }
}
