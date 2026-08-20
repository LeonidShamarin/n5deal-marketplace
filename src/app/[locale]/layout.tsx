import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import { SiteHeader } from "@/components/site-header";
import { routing } from "@/i18n/routing";
import "../globals.css";

// Inter is what the reference site uses; `display: swap` keeps first paint from
// waiting on the font file.
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

const SITE_URL = "https://n5deal-marketplace-beige.vercel.app";
const DESCRIPTION =
  "Marketplace prototype for regulated businesses and licences: sellers list assets, buyers publish acquisition mandates.";

export const metadata: Metadata = {
  // metadataBase makes the relative URLs below absolute in the rendered tags.
  // Crawlers fetch og:image from their own servers, where a relative path has
  // no host to resolve against and the preview ends up with no image.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "N5Deal — M&A Deals Platform",
    template: "%s · N5Deal",
  },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "N5Deal",
    url: "/",
    title: "N5Deal — M&A Deals Platform",
    description: DESCRIPTION,
    images: [
      {
        url: "/og-card.png",
        width: 1200,
        height: 630,
        alt: "N5Deal — M&A Deals Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "N5Deal — M&A Deals Platform",
    description: DESCRIPTION,
    images: ["/og-card.png"],
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // The middleware normally guarantees a valid locale, but a hand-typed
  // "/de/assets" reaches the layout directly. 404 beats rendering in a language
  // that has no messages.
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);

  return (
    // suppressHydrationWarning covers exactly one thing: attributes that browser
    // extensions inject into <html> before React hydrates (a grammar checker adds
    // `data-qb-installed` here, and the console reports a mismatch that is not
    // ours). It does not suppress content mismatches anywhere else in the tree.
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <body className="min-h-dvh bg-white">
        <NextIntlClientProvider>
          <div className="flex min-h-dvh flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <footer className="border-line border-t py-6">
              <div className="text-faint mx-auto max-w-[1200px] px-4 text-[13px]">
                N5Deal marketplace prototype — built as a technical assignment. Data is
                fictional.
              </div>
            </footer>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
