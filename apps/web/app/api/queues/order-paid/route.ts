import { handleCallback } from "@vercel/queue";
import { apiUrl } from "@/lib/api";

/**
 * Consommateur Vercel Queues du sujet "order-paid" (mode push : Vercel appelle
 * cette route). Il demande à l'API d'envoyer l'email de confirmation, par le
 * binding privé, avec le secret interne. Si l'appel échoue, l'exception provoque
 * un nouvel essai automatique de la file. L'API n'envoie qu'un email par commande.
 */
export const POST = handleCallback(
  async (message: { orderId: string }) => {
    const res = await fetch(apiUrl("/internal/notifications/order-paid"), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.CRON_SECRET}` },
      body: JSON.stringify({ orderId: message.orderId }),
    });
    if (!res.ok) throw new Error(`Notification refusée par l'API : HTTP ${res.status}`);
  },
  {
    // Message empoisonné : on arrête après 5 livraisons, avec un délai croissant entre les essais.
    retry: (_error, metadata) =>
      metadata.deliveryCount > 5
        ? { acknowledge: true }
        : { afterSeconds: Math.min(300, 2 ** metadata.deliveryCount * 5) },
  },
);
