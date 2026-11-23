import { StandardSchemaValidationPipe, type INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import helmet from "helmet";

/**
 * Configuration HTTP commune à l'application et aux tests e2e.
 * - préfixe /api/v1 (Vercel transmet le chemin d'origine) ;
 * - helmet : en-têtes de sécurité, CSP stricte (l'API ne sert que du JSON) ;
 * - validation globale par schémas Zod (Standard Schema) ;
 * - pas de CORS : le site et l'API partagent la même origine.
 */
export function configureApp(app: INestApplication): void {
  const express = app as NestExpressApplication;
  express.set("trust proxy", true);
  express.disable("x-powered-by");
  app.setGlobalPrefix("api/v1");
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: "same-origin" },
    }),
  );
  app.use(cookieParser());
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.enableShutdownHooks();
}
