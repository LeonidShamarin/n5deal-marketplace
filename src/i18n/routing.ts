import { defineRouting } from "next-intl/routing";

/**
 * The locale lives in the path segment (`/en/assets`, `/uk/assets`) rather than
 * in a cookie: the URL stays the whole state of the page, which is the same rule
 * the catalogue filters follow. A shared link therefore carries the language too.
 */
export const routing = defineRouting({
  locales: ["en", "uk"],
  defaultLocale: "en",
  // Always prefix, including the default locale — no ambiguity about which
  // language a bare "/assets" means, and no redirect loop to debug later.
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

export function isLocale(value: string): value is Locale {
  return (routing.locales as readonly string[]).includes(value);
}
