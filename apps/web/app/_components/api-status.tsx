import { apiUrl } from "@/lib/api";

interface HealthReport {
  status: string;
  version: string;
}

/** Appelle GET /api/v1/health côté serveur, à chaque requête (donnée non mise en cache). */
export async function ApiStatus() {
  let report: HealthReport | null = null;
  try {
    const res = await fetch(apiUrl("/health"), { cache: "no-store" });
    if (res.ok) report = (await res.json()) as HealthReport;
  } catch {
    report = null;
  }

  return (
    <p role="status" className="text-sm">
      {report?.status === "ok" ? (
        <>
          API en ligne <span className="text-foret">(version {report.version})</span>
        </>
      ) : (
        <span className="text-balise">API injoignable</span>
      )}
    </p>
  );
}
