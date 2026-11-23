import Image from "next/image";

interface Props {
  brand: string;
  name: string;
  imageUrl: string | null;
  imageAlt: string | null;
  priority?: boolean;
}

/**
 * Visuel produit. Les photos arrivent avec l'upload du back-office (Vercel Blob).
 * En attendant, une vignette typographique sobre : pas d'image factice.
 */
export function ProductVisual({ brand, name, imageUrl, imageAlt, priority }: Props) {
  if (imageUrl) {
    return (
      <div className="relative aspect-[4/3] bg-craie">
        <Image
          src={imageUrl}
          alt={imageAlt ?? `${brand} ${name}`}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-contain p-4"
          priority={priority}
        />
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="flex aspect-[4/3] flex-col justify-end bg-foret p-4 text-craie">
      <span className="text-xs font-semibold uppercase tracking-widest text-craie/80">{brand}</span>
      <span className="font-display text-4xl font-bold uppercase leading-none">{name}</span>
    </div>
  );
}
