import type { Metadata } from "next";
import Link from "next/link";
import { TERMS_VERSION } from "@lafoulee/shared";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation",
  description: "Règles d'utilisation du site La Foulée et du compte client.",
  alternates: { canonical: "/conditions-generales-d-utilisation" },
};

const h2 = "font-display tracking-tight text-3xl font-extrabold";

/** Conditions générales d'utilisation : acceptées par une case à cocher à l'inscription (date et version gardées). */
export default function CguPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-10 leading-relaxed">
      <h1 className="font-display tracking-tight text-5xl font-extrabold">Conditions générales d&apos;utilisation</h1>
      <p className="border-l-4 border-balise bg-white p-3">
        Site de démonstration : La Foulée est une enseigne fictive. Les achats sont régis par les{" "}
        <Link href="/conditions-generales-de-vente" className="underline underline-offset-4">
          conditions générales de vente
        </Link>
        .
      </p>
      <p className="text-sm text-asphalte/80">Version du {TERMS_VERSION.split("-").reverse().join("/")}.</p>

      <section className="space-y-2">
        <h2 className={h2}>1. Objet</h2>
        <p>
          Ces conditions fixent les règles d&apos;utilisation du site et du compte client. Le site est accessible sans
          compte ; un compte permet de suivre ses commandes et de gérer ses données.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>2. Compte client</h2>
        <p>
          Vous créez un compte avec une adresse email que vous confirmez, et un mot de passe d&apos;au moins 12
          caractères. Vous gardez ce mot de passe secret. Nous vous conseillons d&apos;activer la double
          authentification depuis votre compte. Prévenez-nous si vous pensez que quelqu&apos;un utilise votre compte.
        </p>
        <p>
          Vous pouvez à tout moment modifier vos informations, télécharger vos données ou supprimer votre compte depuis
          la page Mon compte.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>3. Utilisation du site</h2>
        <p>
          Il est interdit de perturber le site (envoi massif de requêtes, tentative d&apos;accès aux comptes
          d&apos;autrui, contournement des sécurités). En cas d&apos;abus, l&apos;accès peut être limité ou le compte
          suspendu.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>4. Propriété intellectuelle</h2>
        <p>
          Les textes, la charte graphique et les illustrations du site appartiennent à La Foulée ou à leurs auteurs,
          cités dans les{" "}
          <Link href="/mentions-legales" className="underline underline-offset-4">
            mentions légales
          </Link>
          . Les marques citées appartiennent à leurs titulaires.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>5. Responsabilité et disponibilité</h2>
        <p>
          Nous faisons notre possible pour que le site soit disponible et exact, sans pouvoir le garantir en continu.
          Une interruption pour maintenance peut avoir lieu.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>6. Données personnelles</h2>
        <p>
          Le compte est géré pour exécuter le contrat qui nous lie (article 6.1.b du RGPD). Le détail des données, des
          durées et de vos droits est dans la{" "}
          <Link href="/confidentialite" className="underline underline-offset-4">
            politique de confidentialité
          </Link>
          .
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={h2}>7. Modification</h2>
        <p>
          Ces conditions peuvent évoluer. La version acceptée et sa date sont enregistrées avec votre compte. Une
          nouvelle version vous sera présentée avant de s&apos;appliquer. Droit applicable : droit français.
        </p>
      </section>
    </article>
  );
}
