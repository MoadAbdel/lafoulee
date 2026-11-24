import type { Metadata } from "next";
import Link from "next/link";
import { ManageConsentButton } from "@/components/consent-banner";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Données collectées par La Foulée, finalités, durées de conservation et exercice de vos droits.",
};

const TREATMENTS = [
  [
    "Compte client",
    "Email, prénom, mot de passe haché",
    "Exécution du contrat",
    "Jusqu'à la suppression, ou 3 ans après la dernière connexion",
  ],
  [
    "Commandes",
    "Articles, montants, boutique ou adresse de livraison, email",
    "Contrat et obligation légale",
    "10 ans (pièces comptables, article L123-22 du Code de commerce), sans donnée identifiante après une demande d'effacement",
  ],
  [
    "Paiement",
    "Traité par Stripe : nous ne voyons jamais votre carte",
    "Exécution du contrat",
    "Selon Stripe (prestataire certifié PCI DSS)",
  ],
  [
    "Newsletter",
    "Email",
    "Consentement (double confirmation)",
    "Jusqu'à la désinscription. Inscription non confirmée : effacée après 7 jours",
  ],
  [
    "Choix sur les cookies",
    "Identifiant aléatoire, version, choix",
    "Obligation légale (preuve du consentement)",
    "6 mois",
  ],
  ["Sécurité", "Journal des actions des administrateurs, adresse IP", "Intérêt légitime", "1 an"],
  [
    "Mesure d'audience",
    "Pages vues, sans cookie ni identifiant (Vercel Web Analytics)",
    "Intérêt légitime",
    "Données agrégées",
  ],
] as const;

/** Vue "Politique de confidentialité et traitement des données" (dossier, C11). Accessible depuis chaque page. */
export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 py-10 leading-relaxed">
      <header>
        <h1 className="font-display tracking-tight text-5xl font-extrabold">Politique de confidentialité</h1>
        <p className="mt-2 text-sm text-asphalte/80">
          Mise à jour : novembre 2026. La Foulée est une enseigne fictive (projet de démonstration).
        </p>
      </header>

      <section aria-labelledby="responsable">
        <h2 id="responsable" className="font-display tracking-tight text-3xl font-extrabold">
          Responsable du traitement
        </h2>
        <p>La Foulée, 42 rue d&apos;Austerlitz, 69004 Lyon. Contact pour vos données : le formulaire ci-dessous.</p>
      </section>

      <section aria-labelledby="traitements">
        <h2 id="traitements" className="font-display tracking-tight text-3xl font-extrabold">
          Données, finalités et durées
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border border-asphalte/15 bg-white text-left text-sm">
            <thead className="bg-craie">
              <tr>
                <th scope="col" className="p-2">
                  Traitement
                </th>
                <th scope="col" className="p-2">
                  Données
                </th>
                <th scope="col" className="p-2">
                  Base légale
                </th>
                <th scope="col" className="p-2">
                  Conservation
                </th>
              </tr>
            </thead>
            <tbody>
              {TREATMENTS.map(([name, data, basis, duration]) => (
                <tr key={name} className="border-t border-asphalte/10 align-top">
                  <th scope="row" className="p-2 font-semibold">
                    {name}
                  </th>
                  <td className="p-2">{data}</td>
                  <td className="p-2">{basis}</td>
                  <td className="p-2">{duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="destinataires">
        <h2 id="destinataires" className="font-display tracking-tight text-3xl font-extrabold">
          Sous-traitants
        </h2>
        <ul className="list-inside list-disc">
          <li>Vercel (hébergement, fonctions exécutées à Francfort)</li>
          <li>Neon (base de données, Francfort) et Upstash (cache et panier, Francfort)</li>
          <li>Stripe (paiement) et Brevo (envoi des emails)</li>
          <li>Google (carte des boutiques, seulement si vous l&apos;acceptez)</li>
        </ul>
        <p className="mt-2">
          Les sociétés établies aux États-Unis (Vercel, Stripe, Google) sont couvertes par le Data Privacy Framework et
          des clauses contractuelles types de la Commission européenne.
        </p>
      </section>

      <section aria-labelledby="cookies">
        <h2 id="cookies" className="font-display tracking-tight text-3xl font-extrabold">
          Cookies
        </h2>
        <p>
          Cookies essentiels, sans consentement : session (<code>lf_at</code>, <code>lf_rt</code>) et panier (
          <code>lf_cart</code>), tous protégés (HttpOnly). Avec votre accord seulement : la carte Google Maps de la page
          Boutiques. Votre choix est redemandé après 6 mois.
        </p>
        <p className="mt-2">
          <ManageConsentButton />
        </p>
      </section>

      <section aria-labelledby="droits">
        <h2 id="droits" className="font-display tracking-tight text-3xl font-extrabold">
          Vos droits
        </h2>
        <p>
          Vous pouvez accéder à vos données, les recevoir dans un format lisible, les faire rectifier ou effacer, et
          vous opposer à un traitement. Réponse sous un mois au plus tard.
        </p>
        <ul className="mt-2 list-inside list-disc">
          <li>
            Avec un compte : téléchargement et suppression immédiats depuis{" "}
            <Link prefetch={false} href="/compte" className="underline underline-offset-4">
              Mon compte
            </Link>
            .
          </li>
          <li>
            Sans compte (commande ou newsletter) :{" "}
            <Link href="/confidentialite/demande" className="underline underline-offset-4">
              formulaire de demande
            </Link>
            .
          </li>
          <li>
            Vous pouvez aussi saisir la CNIL :{" "}
            <a href="https://www.cnil.fr/fr/plaintes" className="underline underline-offset-4">
              cnil.fr/fr/plaintes
            </a>
            .
          </li>
        </ul>
      </section>
    </article>
  );
}
