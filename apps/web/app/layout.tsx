import type { Metadata } from "next";
import { Barlow_Condensed } from "next/font/google";
import "./globals.css";

// Police des titres, auto-hébergée par next/font (aucun appel à Google côté visiteur).
const barlow = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "La Foulée : boutique de course à pied à Lyon",
    template: "%s | La Foulée",
  },
  description:
    "Chaussures de running et de trail, textile et nutrition. Retrait gratuit dans nos 3 boutiques lyonnaises.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${barlow.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:bg-asphalte focus:px-4 focus:py-2 focus:text-craie"
        >
          Aller au contenu
        </a>
        {children}
      </body>
    </html>
  );
}
