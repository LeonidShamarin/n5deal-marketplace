/**
 * Money handling.
 *
 * Amounts live in the database as integer minor units (cents) plus a currency
 * enum. Floats are never used: 0.1 + 0.2 is a rounding bug waiting to be found
 * by whoever compares an asking price against a buyer's ticket range.
 *
 * The carrier type is `bigint`, not `number`. Postgres INT4 stops at 2.1 billion
 * minor units — about EUR 21.5M — which a banking licence clears without effort.
 * Storing major units instead would have kept `number`, at the cost of the
 * exactness that made minor units the choice in the first place.
 *
 * Everything a user types goes through `parseMajorUnits`, everything a user sees
 * goes through `formatMoney`.
 */

import type { Currency } from "@prisma/client";
import { CURRENCY_SYMBOLS } from "./vocabulary";

export const MINOR_UNITS_PER_MAJOR = 100n;

/** Guard rail for the listing form: one billion in major units. */
export const MAX_PRICE_MINOR = 1_000_000_000n * MINOR_UNITS_PER_MAJOR;

/**
 * Parse a human-entered amount ("2 500 000", "2,500,000.50", "1.2M") into minor
 * units. Returns null for anything it cannot read, so callers decide what an
 * invalid amount means; the zod schemas turn that null into a field error.
 */
export function parseMajorUnits(input: string): bigint | null {
  // Includes the non-breaking and narrow no-break spaces that a copy-paste from
  // a spreadsheet or a browser-formatted number brings along.
  const cleaned = input.trim().replace(/[\s  ']/g, "");
  if (cleaned === "") return null;

  // "1.2M" / "750k" — common shorthand in deal listings.
  const shorthand = /^([0-9]+(?:[.,][0-9]+)?)([kKmM])$/.exec(cleaned);
  if (shorthand) {
    const [, digits, suffix] = shorthand;
    const multiplier = suffix.toLowerCase() === "k" ? 1_000 : 1_000_000;
    const value = Number(digits.replace(",", "."));
    if (!Number.isFinite(value)) return null;
    return BigInt(Math.round(value * multiplier)) * MINOR_UNITS_PER_MAJOR;
  }

  const normalised = normaliseSeparators(cleaned);
  if (normalised === null) return null;

  const [whole, fraction = ""] = normalised.split(".");
  if (whole === "" && fraction === "") return null;

  // Build the value digit by digit rather than via Number(), so a 12-digit
  // amount does not lose precision on the way in.
  const cents = (fraction + "00").slice(0, 2);
  try {
    return BigInt(whole === "" ? "0" : whole) * MINOR_UNITS_PER_MAJOR + BigInt(cents);
  } catch {
    return null;
  }
}

/**
 * "1,234,567.89" and "1.234.567,89" both mean the same number, and both are
 * typed by real users. A trailing group of one or two digits after the last
 * separator is the decimal part; anything else means every separator was a
 * thousands mark.
 */
function normaliseSeparators(cleaned: string): string | null {
  if (!/^[0-9.,]+$/.test(cleaned)) return null;

  const lastSeparator = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));
  if (lastSeparator === -1) return cleaned;

  const decimals = cleaned.length - lastSeparator - 1;
  if (decimals !== 1 && decimals !== 2) {
    return cleaned.replace(/[.,]/g, "");
  }

  const whole = cleaned.slice(0, lastSeparator).replace(/[.,]/g, "");
  const fraction = cleaned.slice(lastSeparator + 1);
  if (whole === "") return null;
  return `${whole}.${fraction}`;
}

/** Minor units to a plain number of major units, for formatting only. */
export function toMajorUnits(minor: bigint): number {
  return Number(minor) / Number(MINOR_UNITS_PER_MAJOR);
}

export function toMinorUnits(major: number): bigint {
  return BigInt(Math.round(major * Number(MINOR_UNITS_PER_MAJOR)));
}

/**
 * Full amount with currency, formatted for the given locale.
 * Whole amounts drop the cents: asking prices in this market are round numbers,
 * and "€2,500,000.00" is noise on a card.
 */
export function formatMoney(minor: bigint, currency: Currency, locale = "en"): string {
  const whole = minor % MINOR_UNITS_PER_MAJOR === 0n;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: whole ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(toMajorUnits(minor));
}

/**
 * Compact form for cards and facet labels: "€2.5M", "€750K".
 * Intl's own compact notation is locale-aware but yields "2,5 mln" in some
 * locales, which breaks the fixed-width price cell, so only the number is
 * localised and the suffix stays put.
 */
export function formatMoneyCompact(
  minor: bigint,
  currency: Currency,
  locale = "en",
): string {
  const major = toMajorUnits(minor);
  const symbol = CURRENCY_SYMBOLS[currency];

  const [value, suffix] =
    major >= 1_000_000
      ? [major / 1_000_000, "M"]
      : major >= 1_000
        ? [major / 1_000, "K"]
        : [major, ""];

  const digits = suffix !== "" && value < 100 && !Number.isInteger(value) ? 1 : 0;
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);

  return `${symbol}${formatted}${suffix}`;
}

/** Inclusive range check, shared by the price facet and the matching score. */
export function isWithinRange(
  amount: bigint,
  min: bigint | null | undefined,
  max: bigint | null | undefined,
): boolean {
  if (min != null && amount < min) return false;
  if (max != null && amount > max) return false;
  return true;
}

/** Renders a ticket range as "€1M – €6M", "from €1M", "up to €6M" or a dash. */
export function formatRange(
  min: bigint | null | undefined,
  max: bigint | null | undefined,
  currency: Currency,
  locale = "en",
): string {
  const lo = min == null ? null : formatMoneyCompact(min, currency, locale);
  const hi = max == null ? null : formatMoneyCompact(max, currency, locale);

  if (lo && hi) return `${lo} – ${hi}`;
  if (lo) return `${lo}+`;
  if (hi) return `≤ ${hi}`;
  return "—";
}
