import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { vi } from "vitest";
import type { App } from "supertest/types.js";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { MailService, type MailMessage } from "../src/mail/mail.service.js";
import { PrismaService } from "../src/prisma/prisma.service.js";
import { REDIS } from "../src/redis/redis.constants.js";
import type { Redis } from "@upstash/redis";
import { StripeGateway } from "../src/payments/stripe.gateway.js";
import { FakeStripeGateway } from "./fake-stripe.js";

export interface TestApp {
  app: INestApplication<App>;
  prisma: PrismaService;
  redis: Redis;
  /** Emails "envoyés" pendant le test (le service d'envoi est remplacé). */
  mails: MailMessage[];
  stripe: FakeStripeGateway;
}

export async function createTestApp(): Promise<TestApp> {
  const mails: MailMessage[] = [];
  const stripe = new FakeStripeGateway();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue({ send: vi.fn((message: MailMessage) => Promise.resolve(void mails.push(message))) })
    .overrideProvider(StripeGateway)
    .useValue(stripe)
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({ rawBody: true });
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService), redis: app.get(REDIS), mails, stripe };
}

/** Efface les compteurs de limitation de débit entre deux tests. */
export async function resetRateLimits(redis: Redis): Promise<void> {
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, { match: "*ratelimit:*", count: 500 });
    if (keys.length) await redis.del(...keys);
    cursor = String(next);
  } while (cursor !== "0");
}

/** Extrait le jeton du lien de vérification contenu dans un email. */
export function tokenFromMail(message: MailMessage | undefined): string {
  const match = message?.text.match(/token=([A-Za-z0-9_-]{43})/);
  if (!match?.[1]) throw new Error("Aucun lien de vérification dans l'email");
  return match[1];
}

/** Adresse unique par test, pour ne pas dépendre de l'ordre d'exécution. */
export function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.lafoulee.example`;
}
