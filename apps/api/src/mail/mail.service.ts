import { Inject, Injectable, Logger } from "@nestjs/common";
import { ENV, type Env } from "../config/env.js";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Pièces jointes (contenu en clair, encodé en base64 à l'envoi). */
  attachments?: { name: string; content: string }[];
}

/**
 * Envoi d'emails transactionnels par l'API Brevo.
 * Sans clé Brevo (développement), le message est écrit dans les logs pour
 * pouvoir tester les liens. En production sans clé, rien n'est envoyé ni
 * journalisé en clair (le lien est un secret).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(@Inject(ENV) private readonly config: Env) {}

  async send(message: MailMessage): Promise<void> {
    if (!this.config.BREVO_API_KEY) {
      if (this.config.NODE_ENV === "production") {
        this.logger.warn(`Email non envoyé (BREVO_API_KEY absente) : "${message.subject}"`);
      } else {
        this.logger.log(`[email de développement] à ${message.to} : ${message.subject}\n${message.text}`);
      }
      return;
    }

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": this.config.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "La Foulée", email: this.config.MAIL_FROM },
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
        htmlContent: message.html,
        ...(message.attachments?.length
          ? {
              attachment: message.attachments.map((file) => ({
                name: file.name,
                content: Buffer.from(file.content, "utf8").toString("base64"),
              })),
            }
          : {}),
      }),
    });
    if (!res.ok) {
      this.logger.error(`Échec de l'envoi Brevo (HTTP ${res.status}) pour "${message.subject}"`);
      throw new Error("Envoi de l'email impossible");
    }
  }
}
