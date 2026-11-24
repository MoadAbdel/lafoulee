import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="font-display tracking-tight text-5xl font-extrabold">Page introuvable</h1>
      <p className="mt-4">Cette page n&apos;existe pas ou plus. Le produit a peut-être été retiré du catalogue.</p>
      <Link href="/produits" className="mt-6 inline-block font-semibold underline underline-offset-4">
        Voir le catalogue
      </Link>
    </div>
  );
}
