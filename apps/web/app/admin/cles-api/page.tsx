import type { Metadata } from "next";
import { Suspense } from "react";
import type { ApiKeyDto } from "@lafoulee/shared";
import { adminGet } from "@/lib/admin-api";
import { ApiKeysManager } from "./api-keys-manager";

export const metadata: Metadata = { title: "Clés API" };

export default function AdminApiKeysPage() {
  return (
    <>
      <h1 className="font-display text-4xl font-bold uppercase">Clés API partenaires</h1>
      <p className="mt-2 max-w-2xl text-asphalte/80">
        Les partenaires (clubs, organisateurs de courses) lisent le catalogue avec une clé. Documentation :{" "}
        <a href="/api/v1/partner/openapi.json" className="underline underline-offset-4">
          description OpenAPI
        </a>
        .
      </p>
      <Suspense fallback={<p className="mt-4">Chargement des clés...</p>}>
        <Keys />
      </Suspense>
    </>
  );
}

async function Keys() {
  return <ApiKeysManager keys={await adminGet<ApiKeyDto[]>("/api-keys")} />;
}
