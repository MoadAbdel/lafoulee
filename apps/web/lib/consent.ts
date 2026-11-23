import { CONSENT_MAX_AGE_DAYS, CONSENT_VERSION, type ConsentChoices } from "@lafoulee/shared";

/**
 * Choix de consentement, gardés dans le navigateur (localStorage : rien n'est
 * envoyé avec chaque requête). Une preuve sans donnée identifiante est aussi
 * enregistrée côté serveur (RGPD, article 7.1).
 */
export interface StoredConsent {
  id: string;
  version: string;
  date: string;
  choices: ConsentChoices;
}

const KEY = "lf_consentement";
export const CONSENT_EVENT = "lafoulee:consentement";
export const OPEN_CONSENT_EVENT = "lafoulee:ouvrir-consentement";

export function readConsent(now = Date.now()): StoredConsent | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as StoredConsent;
    const ageDays = (now - Date.parse(value.date)) / 86_400_000;
    // Nouvelle version du bandeau, ou choix de plus de 6 mois : on redemande.
    if (value.version !== CONSENT_VERSION || !(ageDays <= CONSENT_MAX_AGE_DAYS)) return null;
    return value;
  } catch {
    return null;
  }
}

export function saveConsent(choices: ConsentChoices): StoredConsent {
  const value: StoredConsent = {
    id: readConsent()?.id ?? crypto.randomUUID(),
    version: CONSENT_VERSION,
    date: new Date().toISOString(),
    choices,
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Stockage indisponible (navigation privée stricte) : le choix vaut pour cette page.
  }
  void fetch("/api/v1/consents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ consentId: value.id, version: value.version, choices }),
  }).catch(() => undefined);
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
  return value;
}
