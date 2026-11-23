import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { configureApp } from "./app.setup.js";
import { env } from "./config/env.js";

/**
 * Point d'entrée de l'API. Vercel le détecte (src/main.ts) et l'exécute
 * comme une fonction. En local, l'API écoute sur le port 4000.
 */
async function bootstrap() {
  env(); // Valide la configuration avant tout : échec immédiat et explicite.
  // rawBody : le webhook Stripe vérifie sa signature sur le corps brut de la requête.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureApp(app);
  await app.listen(process.env.PORT ?? 4000);
}

// Pas de await au niveau du module : Vercel attend la fin du chargement du module
// pour récupérer le serveur HTTP. Une erreur de démarrage arrête le processus.
bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
