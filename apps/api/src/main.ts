import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

/**
 * Point d'entrée de l'API. Vercel le détecte (src/main.ts) et l'exécute
 * comme une fonction. En local, l'API écoute sur le port 4000.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Vercel transmet le chemin d'origine (/api/v1/...) : le préfixe est donc global.
  app.setGlobalPrefix("api/v1");
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 4000);
}
// Pas de await au niveau du module : Vercel attend la fin du chargement du module
// pour récupérer le serveur HTTP. Une erreur de démarrage arrête le processus.
bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
