import { z } from "zod";

/**
 * Zod 4 teste au premier usage si `new Function` est permis (validation compilée).
 * La CSP du site interdit eval : ce test est bloqué et signalé par les navigateurs.
 * Le mode sans compilation évite ce test ; l'écart de vitesse est négligeable ici.
 */
z.config({ jitless: true });
