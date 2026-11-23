"use client";

import { useEffect, useState } from "react";
import { CONSENT_EVENT, OPEN_CONSENT_EVENT, readConsent, type StoredConsent } from "@/lib/consent";

/**
 * Affiche un contenu tiers (carte Google Maps) seulement après consentement.
 * Sans accord, rien n'est chargé depuis Google : un lien texte reste disponible.
 */
export function ConsentGate({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const update = (consent: StoredConsent | null) => setAllowed(consent?.choices.contenusTiers === true);
    update(readConsent());
    const onChange = (event: Event) => update((event as CustomEvent<StoredConsent>).detail);
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  if (allowed) return <>{children}</>;
  return (
    <div className="flex aspect-video flex-col items-center justify-center gap-3 border border-asphalte/20 bg-craie p-4 text-center text-sm">
      {fallback}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
        className="min-h-11 border border-asphalte px-4 font-semibold"
      >
        Autoriser la carte Google Maps
      </button>
    </div>
  );
}
