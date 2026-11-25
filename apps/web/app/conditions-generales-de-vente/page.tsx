import type { Metadata } from "next";
import Link from "next/link";
import {
  CGV_VERSION,
  formatPrice,
  FREE_SHIPPING_THRESHOLD_CENTS,
  RESERVATION_MINUTES,
  SHIPPING_CENTS,
} from "@lafoulee/shared";

export const metadata: Metadata = {
  title: "Conditions générales de vente",
  description:
    "Prix, commande, paiement, retrait et livraison, droit de rétractation et garanties légales de La Foulée.",
  alternates: { canonical: "/conditions-generales-de-vente" },
};

const h2 = "font-display tracking-tight text-3xl font-extrabold";

/**
 * Conditions générales de vente (Code de la consommation, articles L221-5 et suivants).
 * Les montants viennent des constantes du paquet partagé : ils restent égaux à ceux du tunnel.
 */
export default function CgvPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-10 leading-relaxed">
      <h1 className="font-display tracking-tight text-5xl font-extrabold">Conditions générales de vente</h1>
      <p className="border-l-4 border-balise bg-white p-3">
        Site de démonstration : La Foulée est une enseigne fictive. Aucune commande n&apos;est expédiée et les paiements
        se font en mode test. Ces conditions montrent ce qu&apos;un vrai commerce devrait afficher.
      </p>
      <p className="text-sm text-asphalte/80">Version du {CGV_VERSION.split("-").reverse().join("/")}.</p>

      <section className="space-y-2">
        <h2 className={h2}>1. Vendeur</h2>
        <p>
          La Foulée (enseigne fictive), 42 rue d&apos;Austerlitz, 69004 Lyon. Trois boutiques : Croix-Rousse, Part-Dieu
          et Gerland (adresses et horaires sur la page{" "}
          <Link href="/boutiques" className="underline underline-offset-4">
            Nos boutiques
          </Link>
          ). Ces conditions s&apos;appliquent aux achats faits sur ce site par des particuliers.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>2. Produits et prix</h2>
        <p>
          Les produits sont décrits sur leur fiche. Les photos sont des illustrations : elles montrent le type et le
          coloris du produit, sans valeur contractuelle. Les prix sont en euros, toutes taxes comprises.
        </p>
        <p>
          Retrait en boutique : gratuit. Livraison à domicile en France métropolitaine : {formatPrice(SHIPPING_CENTS)},
          offerte dès {formatPrice(FREE_SHIPPING_THRESHOLD_CENTS)} d&apos;achat. Le total à payer est affiché avant le
          paiement.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>3. Commande</h2>
        <ol className="list-decimal space-y-1 pl-6">
          <li>Vous choisissez vos articles, votre pointure ou taille, et le mode de réception.</li>
          <li>Vous acceptez ces conditions, puis vous passez au paiement.</li>
          <li>
            Le stock est réservé pendant {RESERVATION_MINUTES} minutes. Sans paiement dans ce délai, la commande est
            annulée.
          </li>
          <li>Le contrat est conclu au paiement. Un email de confirmation récapitule la commande.</li>
        </ol>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>4. Paiement</h2>
        <p>
          Paiement par carte bancaire (et Apple Pay ou Google Pay selon votre appareil), traité par Stripe, avec
          authentification 3D Secure. Vos données de carte ne passent jamais par nos serveurs. Le montant est débité à
          la commande.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>5. Retrait en boutique et livraison</h2>
        <p>
          Retrait : un email vous prévient quand la commande est prête dans la boutique choisie. Présentez le numéro de
          commande. Livraison : un email vous prévient à l&apos;expédition. Le délai indicatif est de 3 à 5 jours
          ouvrés. En cas de retard de plus de 7 jours sur ce délai, vous pouvez annuler la commande et être remboursé
          (article L216-6 du Code de la consommation).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>6. Droit de rétractation</h2>
        <p>
          Vous disposez de 14 jours pour changer d&apos;avis, sans avoir à vous justifier (article L221-18). Le délai
          court à partir du jour où vous recevez ou retirez la commande. Informez-nous en boutique ou par courrier à
          l&apos;adresse ci-dessus, avec le formulaire ci-dessous ou une déclaration claire, puis renvoyez ou rapportez
          les articles en boutique dans les 14 jours suivants. Les articles doivent être neufs, non portés en extérieur,
          dans leur emballage d&apos;origine. Nous vous remboursons dans les 14 jours suivant votre demande, par le même
          moyen de paiement, frais de livraison initiaux compris. Les frais de retour par la poste restent à votre
          charge ; le retour en boutique est gratuit.
        </p>
        <p>
          Exceptions (article L221-28) : les produits de nutrition descellés après la livraison, et les sous-vêtements
          et chaussettes descellés, pour des raisons d&apos;hygiène.
        </p>
        <div className="border border-asphalte/20 bg-white p-4 text-sm">
          <p className="font-semibold">Formulaire de rétractation</p>
          <p>
            À l&apos;attention de La Foulée, 42 rue d&apos;Austerlitz, 69004 Lyon : je vous notifie par la présente ma
            rétractation du contrat portant sur la vente du bien ci-dessous. Commandé le : ... Reçu le : ... Numéro de
            commande : ... Nom : ... Adresse : ... Date et signature (en cas d&apos;envoi papier).
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>7. Garanties légales</h2>
        <p>
          Garantie légale de conformité : 2 ans à partir de la livraison (articles L217-3 et suivants). En cas de
          défaut, vous choisissez entre la réparation et le remplacement ; à défaut, remboursement ou réduction du prix.
          Garantie des vices cachés : 2 ans à partir de la découverte du vice (articles 1641 et suivants du Code civil).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>8. Service client et médiation</h2>
        <p>
          Pour toute question ou réclamation : dans l&apos;une des trois boutiques, ou par courrier à l&apos;adresse du
          vendeur. Si le désaccord persiste, vous pouvez saisir gratuitement un médiateur de la consommation (article
          L612-1). Enseigne fictive : le médiateur serait désigné par un vrai commerce lors de son adhésion.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>9. Données personnelles et droit applicable</h2>
        <p>
          Les données de votre commande sont traitées comme expliqué dans la{" "}
          <Link href="/confidentialite" className="underline underline-offset-4">
            politique de confidentialité
          </Link>
          . Ces conditions sont soumises au droit français.
        </p>
      </section>
    </article>
  );
}
