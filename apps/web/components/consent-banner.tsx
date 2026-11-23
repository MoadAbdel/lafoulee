"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { OPEN_CONSENT_EVENT, readConsent, saveConsent } from "@/lib/consent";

/**
 * Bandeau de consentement (dossier, C11) :
 * - "Tout accepter" et "Tout refuser" au même niveau, sans case pré-cochée ;
 * - rien de non essentiel n'est chargé avant le choix ;
 * - choix modifiable à tout moment (lien "Gérer les cookies" du pied de page).
 */
export function ConsentBanner() {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [thirdParty, setThirdParty] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const show = () => {
      setThirdParty(readConsent()?.choices.contenusTiers ?? false);
      setOpen(true);
    };
    if (!readConsent()) show();
    window.addEventListener(OPEN_CONSENT_EVENT, show);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, show);
  }, []);

  useEffect(() => {
    if (open) heading.current?.focus();
  }, [open]);

  if (!open) return null;

  const decide = (contenusTiers: boolean) => {
    saveConsent({ contenusTiers });
    setOpen(false);
    setDetails(false);
  };

  return (
    <section
      role="region"
      aria-labelledby="titre-consentement"
      className="fixed inset-x-0 bottom-0 z-20 border-t-4 border-balise bg-white shadow-lg"
    >
      <div className="mx-auto max-w-4xl space-y-3 px-4 py-4">
        <h2 id="titre-consentement" ref={heading} tabIndex={-1} className="font-display text-2xl font-bold uppercase">
          Vos choix sur les cookies
        </h2>
        <p className="text-sm">
          Le site utilise des cookies essentiels (session, panier, sécurité du paiement) : ils ne demandent pas votre
          accord. Avec votre accord seulement, la page Boutiques affiche une carte Google Maps, qui dépose ses propres
          cookies. Notre mesure d&apos;audience ne dépose aucun cookie.{" "}
          <Link href="/confidentialite" className="underline underline-offset-4">
            En savoir plus
          </Link>
        </p>
        {details && (
          <fieldset className="border border-asphalte/20 p-3">
            <legend className="px-1 font-semibold">Personnaliser</legend>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" checked disabled />
              Cookies essentiels (toujours actifs)
            </label>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" checked={thirdParty} onChange={(event) => setThirdParty(event.target.checked)} />
              Contenus tiers : carte Google Maps des boutiques
            </label>
          </fieldset>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => decide(false)}
            className="min-h-11 flex-1 border-2 border-asphalte px-4 font-semibold"
          >
            Tout refuser
          </button>
          <button
            type="button"
            onClick={() => decide(true)}
            className="min-h-11 flex-1 border-2 border-asphalte px-4 font-semibold"
          >
            Tout accepter
          </button>
          {details ? (
            <button
              type="button"
              onClick={() => decide(thirdParty)}
              className="min-h-11 flex-1 bg-asphalte px-4 font-semibold text-craie"
            >
              Enregistrer mes choix
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setDetails(true)}
              className="min-h-11 flex-1 underline underline-offset-4"
            >
              Personnaliser
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/** Lien du pied de page qui rouvre le bandeau. */
export function ManageConsentButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
      className="text-left underline-offset-4 hover:underline"
    >
      Gérer les cookies
    </button>
  );
}
