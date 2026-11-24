import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";

/**
 * Appelée par l'API après une modification du catalogue dans le back-office :
 * les pages en cache (étiquette "catalog") sont régénérées à la requête suivante.
 * Protégée par le secret interne (CRON_SECRET), comparé en temps constant.
 */
export async function POST(request: Request): Promise<Response> {
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET ?? ""}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  if (
    !process.env.CRON_SECRET ||
    process.env.CRON_SECRET.length < 16 ||
    given.length !== expected.length ||
    !timingSafeEqual(given, expected)
  ) {
    return Response.json({ message: "Accès interne refusé." }, { status: 401 });
  }
  // expire: 0 : la requête suivante attend les données à jour (stock, prix) plutôt que de servir l'ancienne version.
  revalidateTag("catalog", { expire: 0 });
  return Response.json({ revalidated: true });
}
