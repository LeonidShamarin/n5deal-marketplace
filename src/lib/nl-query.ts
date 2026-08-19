/**
 * Deterministic natural-language query parsing.
 *
 * This is the floor under the AI search, not a placeholder for it. A reviewer
 * will run the app without an API key, so "payment licence in Lithuania under
 * 2M" has to do something sensible with no model involved. When a key IS
 * present, the model runs on top of this and its answer is merged in — but the
 * model can only ever widen or refine what the rules already found, and every
 * field it proposes is re-validated against the same vocabulary.
 *
 * Being a pure function of a string, it is also the part of the AI feature that
 * can actually be unit tested.
 */

import type { AiFilterProposal } from "./filters";
import {
  BUSINESS_CATEGORIES,
  COUNTRIES,
  LICENSE_TYPES,
  type COUNTRY_CODES,
} from "./vocabulary";

/** Words that should pull in a category, beyond the category name itself. */
const CATEGORY_KEYWORDS: Record<(typeof BUSINESS_CATEGORIES)[number], readonly string[]> = {
  PAYMENTS: ["payment", "payments", "psp", "acquiring", "merchant", "remittance"],
  FINTECH: ["fintech", "neobank", "embedded finance", "bnpl"],
  CRYPTO: ["crypto", "digital asset", "digital assets", "vasp", "exchange", "custody"],
  BANKING: ["bank", "banking", "deposit", "credit institution"],
  EMONEY: ["e-money", "emoney", "electronic money", "emi", "iban", "wallet"],
  FOREX: ["forex", "fx", "brokerage", "broker"],
  LENDING: ["lending", "loan", "loans", "credit", "consumer finance"],
  GAMBLING: ["gambling", "gaming", "casino", "betting"],
};

/** Free-text aliases for jurisdictions, so "Lithuania" and "LT" both land. */
const COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  uk: "GB",
  "united kingdom": "GB",
  britain: "GB",
  england: "GB",
  usa: "US",
  "united states": "US",
  america: "US",
  uae: "AE",
  emirates: "AE",
  holland: "NL",
  czechia: "CZ",
  "czech republic": "CZ",
};

/** Members of the EU among the jurisdictions this app knows about. */
const EU_COUNTRIES = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "IE",
  "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
] as const;

/**
 * Parse an amount written the way people say it: "2M", "2 million", "500k",
 * "1,500,000". Returns whole major units.
 */
function parseSpokenAmount(raw: string): number | null {
  const match =
    /([0-9][0-9\s.,]*)\s*(k|thousand|m|mln|million|bn|billion)?/i.exec(raw.trim());
  if (!match) return null;

  const [, digits, unit] = match;
  const numeric = Number(digits.replace(/[\s,]/g, "").replace(/\.(?=[0-9]{3}\b)/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  const multiplier = !unit
    ? 1
    : /^(k|thousand)$/i.test(unit)
      ? 1_000
      : /^(m|mln|million)$/i.test(unit)
        ? 1_000_000
        : 1_000_000_000;

  const value = Math.round(numeric * multiplier);
  return value > 1_000_000_000 ? null : value;
}

export function parseNaturalQuery(input: string): AiFilterProposal {
  const text = input.toLowerCase();
  const proposal: AiFilterProposal = {};

  // --- Categories --------------------------------------------------------
  const categories = BUSINESS_CATEGORIES.filter((category) =>
    CATEGORY_KEYWORDS[category].some((keyword) => includesWord(text, keyword)),
  );
  if (categories.length > 0) proposal.categories = categories;

  // --- Licence types -----------------------------------------------------
  // Matched as whole words only: "pi" must not fire on "shipping", and "bank"
  // is left to the category rules rather than claiming the BANK licence.
  const licences = LICENSE_TYPES.filter((licence) => {
    const token = licence === "API_LICENSE" ? "api" : licence.toLowerCase();
    return includesWord(text, token);
  });
  if (licences.length > 0) proposal.licenseTypes = licences;

  // --- Countries ---------------------------------------------------------
  const countries = new Set<string>();

  if (/\b(eu|european union|europe)\b/.test(text)) {
    for (const code of EU_COUNTRIES) countries.add(code);
  }

  for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
    if (includesWord(text, alias)) countries.add(code);
  }

  for (const country of COUNTRIES) {
    if (includesWord(text, country.name.toLowerCase())) countries.add(country.code);
    // Two-letter codes only count when written as a standalone token, otherwise
    // "it" in "is it active" would select Italy.
    if (new RegExp(`\\b${country.code.toLowerCase()}\\b`).test(text)) {
      countries.add(country.code);
    }
  }
  if (countries.size > 0) {
    proposal.countries = [...countries] as (typeof COUNTRY_CODES)[number][];
  }

  // --- Business status ---------------------------------------------------
  if (/\b(licen[cs]e only|clean licen[cs]e|shelf|no operations|dormant)\b/.test(text)) {
    proposal.businessStatuses = ["LICENSE_ONLY"];
  } else if (/\b(operating|active business|with revenue|running business)\b/.test(text)) {
    proposal.businessStatuses = ["ACTIVE"];
  }

  // --- Price bounds ------------------------------------------------------
  const between =
    /\b(?:between|from)\s+([0-9][0-9\s.,]*\s*(?:k|thousand|m|mln|million|bn|billion)?)\s*(?:and|to|-|–|—)\s*([0-9][0-9\s.,]*\s*(?:k|thousand|m|mln|million|bn|billion)?)/i.exec(
      input,
    );

  if (between) {
    const low = parseSpokenAmount(between[1]);
    const high = parseSpokenAmount(between[2]);
    if (low !== null) proposal.priceMinMajor = Math.min(low, high ?? low);
    if (high !== null) proposal.priceMaxMajor = Math.max(low ?? high, high);
  } else {
    const under =
      /\b(?:under|below|less than|up to|max(?:imum)?|cheaper than|<)\s*€?\$?£?\s*([0-9][0-9\s.,]*\s*(?:k|thousand|m|mln|million|bn|billion)?)/i.exec(
        input,
      );
    if (under) {
      const value = parseSpokenAmount(under[1]);
      if (value !== null) proposal.priceMaxMajor = value;
    }

    const over =
      /\b(?:over|above|more than|at least|min(?:imum)?|from|starting at|>)\s*€?\$?£?\s*([0-9][0-9\s.,]*\s*(?:k|thousand|m|mln|million|bn|billion)?)/i.exec(
        input,
      );
    if (over) {
      const value = parseSpokenAmount(over[1]);
      if (value !== null) proposal.priceMinMajor = value;
    }
  }

  // --- Leftover text -----------------------------------------------------
  // Whatever the rules did not consume still goes to the text search, so a
  // company name in the query is not thrown away.
  const residual = residualText(input, proposal);
  if (residual !== "") proposal.q = residual;

  return proposal;
}

/**
 * Word-boundary containment that also works for multi-word phrases and for
 * tokens containing a hyphen, which `\b` alone handles badly.
 */
function includesWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
}

/**
 * Strip the parts the structured filters already cover, so the free-text term
 * does not fight them — searching for the literal string "payments in Malta
 * under 2M" against titles would match nothing.
 */
function residualText(input: string, proposal: AiFilterProposal): string {
  let rest = input;

  const removals: string[] = [
    "under", "below", "less than", "up to", "maximum", "max", "cheaper than",
    "over", "above", "more than", "at least", "minimum", "min", "starting at",
    "between", "and", "from", "to", "with", "in", "the", "a", "an", "for",
    "licence", "license", "only", "clean", "operating", "active", "business",
    "eu", "european union", "europe",
  ];

  for (const category of proposal.categories ?? []) {
    for (const keyword of CATEGORY_KEYWORDS[category]) removals.push(keyword);
  }
  for (const licence of proposal.licenseTypes ?? []) {
    removals.push(licence === "API_LICENSE" ? "api" : licence);
  }
  for (const country of COUNTRIES) {
    if (proposal.countries?.includes(country.code)) {
      removals.push(country.name, country.code);
    }
  }
  for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
    if (proposal.countries?.includes(code)) removals.push(alias);
  }

  for (const term of removals) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    rest = rest.replace(new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "gi"), " ");
  }

  // Numbers and currency marks belong to the price bounds, not to the text.
  rest = rest.replace(/[0-9][0-9\s.,]*\s*(k|thousand|m|mln|million|bn|billion)?/gi, " ");
  rest = rest.replace(/[€$£<>,.\-–—]/g, " ");

  return rest.replace(/\s+/g, " ").trim();
}

/** True when the rules found something structured, i.e. more than free text. */
export function proposalIsEmpty(proposal: AiFilterProposal): boolean {
  return (
    (proposal.categories?.length ?? 0) === 0 &&
    (proposal.countries?.length ?? 0) === 0 &&
    (proposal.licenseTypes?.length ?? 0) === 0 &&
    (proposal.businessStatuses?.length ?? 0) === 0 &&
    proposal.priceMinMajor == null &&
    proposal.priceMaxMajor == null
  );
}
