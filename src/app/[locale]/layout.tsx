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

export const metadata: Metadata = {
  title: {
    default: "N5Deal — M&A Deals Platform",
    template: "%s · N5Deal",
  },
  description:
    "Marketplace prototype for regulated businesses and licences: sellers list assets, buyers publish acquisition mandates.",
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
            <footer className="border-t border-line py-6">
              <div className="mx-auto max-w-[1200px] px-4 text-[13px] text-faint">
                N5Deal marketplace prototype — built as a technical assignment.
                Data is fictional.
              </div>
            </footer>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
