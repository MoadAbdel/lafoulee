import Image from "next/image";

interface Props {
  brand: string;
  name: string;
  imageUrl: string | null;
  imageAlt: string | null;
  priority?: boolean;
  /** Vignette (tableau de l'accueil) : texte de remplacement réduit. */
  compact?: boolean;
}

/**
 * Visuel produit : la photo (Wikimedia Commons sous licence libre, ou envoyée depuis le
 * back-office dans Vercel Blob). Sans photo, une vignette typographique : jamais d'image factice.
 */
/**
 * Couleur de la vignette sans photo : rouge, cobalt ou encre selon le produit (toujours la
 * même pour un produit donné). Texte blanc : contraste de 4,7:1 à 19,2:1.
 */
const TONES = ["bg-balise", "bg-foret", "bg-asphalte"] as const;
function toneOf(key: string): string {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length]!;
}

export function ProductVisual({ brand, name, imageUrl, imageAlt, priority, compact }: Props) {
  if (imageUrl) {
    return (
      <div className="relative aspect-[4/3] bg-papier">
        <Image
          src={imageUrl}
          alt={imageAlt ?? `${brand} ${name}`}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-contain"
          priority={priority}
        />
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      className={`flex aspect-[4/3] flex-col justify-end text-craie ${toneOf(brand + name)} ${compact ? "p-2" : "p-4"}`}
    >
      <span className="text-xs font-semibold uppercase tracking-widest text-craie">{brand}</span>
      <span className={`font-display font-extrabold leading-none tracking-tight ${compact ? "text-base" : "text-4xl"}`}>
        {name}
      </span>
    </div>
  );
}
