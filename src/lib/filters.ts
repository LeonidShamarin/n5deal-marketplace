/**
 * Catalogue state, held in the URL.
 *
 * Every filter, the search text, the sort order and the page number are read
 * from `searchParams` and written back to the URL. Nothing about a result list
 * lives in component state. That single decision is what delivers three separate
 * requirements at once:
 *
 *   - "application state persists after refresh" — reloading re-reads the URL;
 *   - a filtered view is a shareable link, and the back button steps through
 *     filter changes the way a user expects;
 *   - filtering runs in Postgres against the same parameters, so the page never
 *     fetches a thousand rows to hide most of them in the browser.
 *
 * The parsers here are deliberately forgiving. A hand-edited URL with a typo in
 * a category must not throw — it should drop the unknown value and render the
 * rest, because a 500 on `?category=paymnets` would be a worse answer than a
 * slightly different result set.
 */

import { z } from "zod";

import {
  BUSINESS_CATEGORIES,
  BUSINESS_STATUSES,
  COUNTRY_CODES,
  LICENSE_TYPES,
} from "./vocabulary";
import { parseMajorUnits } from "./money";

export const PAGE_SIZE = 12;
export const MAX_PAGE = 500; // hard ceiling: `?page=1e9` must not ask Postgres for a huge offset

/** The raw shape Next hands a page: a value can be absent, single or repeated. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(raw: string | string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * Multi-value facets travel as one comma-separated parameter
 * (`?category=EMONEY,PAYMENTS`) rather than as repeated keys. It keeps the URL
 * readable, and repeated keys are still accepted because a hand-written link may
 * use them.
 */
function parseList<T extends string>(
  raw: string | string[] | undefined,
  allowed: readonly T[],
): T[] {
  if (raw === undefined) return [];
  const parts = (Array.isArray(raw) ? raw : [raw])
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value !== "");

  const allowedSet = new Set<string>(allowed);
  // Deduplicate while keeping the order the user picked them in.
  return [...new Set(parts.filter((value) => allowedSet.has(value)))] as T[];
}

function parsePage(raw: string | string[] | undefined): number {
  const value = Number(firstValue(raw));
  if (!Number.isInteger(value) || value < 1) return 1;
  return Math.min(value, MAX_PAGE);
}

function parseSearch(raw: string | string[] | undefined): string {
  const value = firstValue(raw)?.trim() ?? "";
  // A 2000-character "search term" is not a search term.
  return value.slice(0, 120);
}

function parseMoney(raw: string | string[] | undefined): bigint | null {
  const value = firstValue(raw);
  if (value === undefined || value.trim() === "") return null;
  return parseMajorUnits(value);
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export const ASSET_SORTS = ["newest", "priceAsc", "priceDesc", "popular"] as const;
export type AssetSort = (typeof ASSET_SORTS)[number];

export type AssetFilters = {
  q: string;
  categories: (typeof BUSINESS_CATEGORIES)[number][];
  countries: string[];
  licenseTypes: (typeof LICENSE_TYPES)[number][];
  businessStatuses: (typeof BUSINESS_STATUSES)[number][];
  priceMin: bigint | null;
  priceMax: bigint | null;
  sort: AssetSort;
  page: number;
};

export function parseAssetFilters(params: RawSearchParams): AssetFilters {
  const sortRaw = firstValue(params.sort);
  const sort = (ASSET_SORTS as readonly string[]).includes(sortRaw ?? "")
    ? (sortRaw as AssetSort)
    : "newest";

  let priceMin = parseMoney(params.priceMin);
  let priceMax = parseMoney(params.priceMax);

  // A reversed range would otherwise return nothing at all with no explanation.
  // Swapping is what the user meant; erroring is not.
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) {
    [priceMin, priceMax] = [priceMax, priceMin];
  }

  return {
    q: parseSearch(params.q),
    categories: parseList(params.category, BUSINESS_CATEGORIES),
    countries: parseList(params.country, COUNTRY_CODES),
    licenseTypes: parseList(params.license, LICENSE_TYPES),
    businessStatuses: parseList(params.businessStatus, BUSINESS_STATUSES),
    priceMin,
    priceMax,
    sort,
    page: parsePage(params.page),
  };
}

// ---------------------------------------------------------------------------
// Buyers — the mirror image, over the same vocabulary
// ---------------------------------------------------------------------------

export const BUYER_SORTS = ["newest", "ticketDesc", "ticketAsc"] as const;
export type BuyerSort = (typeof BUYER_SORTS)[number];

export type BuyerFilters = {
  q: string;
  categories: (typeof BUSINESS_CATEGORIES)[number][];
  countries: string[];
  licenseTypes: (typeof LICENSE_TYPES)[number][];
  /** Matches mandates whose ticket range overlaps the given one. */
  ticketMin: bigint | null;
  ticketMax: bigint | null;
  needsActiveLicense: boolean | null;
  sort: BuyerSort;
  page: number;
};

export function parseBuyerFilters(params: RawSearchParams): BuyerFilters {
  const sortRaw = firstValue(params.sort);
  const sort = (BUYER_SORTS as readonly string[]).includes(sortRaw ?? "")
    ? (sortRaw as BuyerSort)
    : "newest";

  let ticketMin = parseMoney(params.ticketMin);
  let ticketMax = parseMoney(params.ticketMax);
  if (ticketMin !== null && ticketMax !== null && ticketMin > ticketMax) {
    [ticketMin, ticketMax] = [ticketMax, ticketMin];
  }

  const activeRaw = firstValue(params.needsActive);

  return {
    q: parseSearch(params.q),
    categories: parseList(params.category, BUSINESS_CATEGORIES),
    countries: parseList(params.country, COUNTRY_CODES),
    licenseTypes: parseList(params.license, LICENSE_TYPES),
    ticketMin,
    ticketMax,
    needsActiveLicense: activeRaw === "1" ? true : activeRaw === "0" ? false : null,
    sort,
    page: parsePage(params.page),
  };
}

// ---------------------------------------------------------------------------
// Writing state back into a URL
// ---------------------------------------------------------------------------

export type QueryValue = string | number | boolean | readonly string[] | null | undefined;

/**
 * Build a query string from a patch applied to the current parameters.
 *
 * Two rules make the resulting URLs behave: an empty value removes the key
 * rather than leaving `?category=` behind, and any change other than paging
 * resets to page 1 — otherwise narrowing a filter from page 7 lands on an empty
 * list that looks like a bug.
 */
export function buildQuery(
  current: URLSearchParams | RawSearchParams,
  patch: Record<string, QueryValue>,
): string {
  const next = new URLSearchParams();

  if (current instanceof URLSearchParams) {
    for (const [key, value] of current.entries()) next.append(key, value);
  } else {
    for (const [key, value] of Object.entries(current)) {
      if (value === undefined) continue;
      for (const item of Array.isArray(value) ? value : [value]) next.append(key, item);
    }
  }

  for (const [key, value] of Object.entries(patch)) {
    next.delete(key);

    if (value === null || value === undefined || value === "" || value === false)
      continue;
    if (Array.isArray(value)) {
      if (value.length > 0) next.set(key, value.join(","));
      continue;
    }
    next.set(key, String(value));
  }

  if (!("page" in patch)) next.delete("page");
  if (next.get("page") === "1") next.delete("page");

  // Stable key order keeps the same filter selection from producing two
  // different URLs, which matters for caching and for "did anything change".
  const sorted = new URLSearchParams(
    [...next.entries()].sort(([a], [b]) => a.localeCompare(b)),
  );
  const query = sorted.toString();
  return query === "" ? "" : `?${query}`;
}

/** True when any facet is engaged — drives whether "Reset" is offered. */
export function hasActiveAssetFilters(filters: AssetFilters): boolean {
  return (
    filters.q !== "" ||
    filters.categories.length > 0 ||
    filters.countries.length > 0 ||
    filters.licenseTypes.length > 0 ||
    filters.businessStatuses.length > 0 ||
    filters.priceMin !== null ||
    filters.priceMax !== null
  );
}

export function hasActiveBuyerFilters(filters: BuyerFilters): boolean {
  return (
    filters.q !== "" ||
    filters.categories.length > 0 ||
    filters.countries.length > 0 ||
    filters.licenseTypes.length > 0 ||
    filters.ticketMin !== null ||
    filters.ticketMax !== null ||
    filters.needsActiveLicense !== null
  );
}

/**
 * The schema an AI-parsed natural-language query must satisfy before it is
 * allowed anywhere near the database. The model proposes; zod disposes.
 */
export const aiFilterSchema = z.object({
  q: z.string().max(120).optional(),
  categories: z.array(z.enum(BUSINESS_CATEGORIES)).max(8).optional(),
  countries: z
    .array(z.enum(COUNTRY_CODES as [string, ...string[]]))
    .max(12)
    .optional(),
  licenseTypes: z.array(z.enum(LICENSE_TYPES)).max(8).optional(),
  businessStatuses: z.array(z.enum(BUSINESS_STATUSES)).max(2).optional(),
  /** Major units, as a person would say them; converted to minor units after parsing. */
  priceMinMajor: z.number().int().nonnegative().max(1_000_000_000).nullable().optional(),
  priceMaxMajor: z.number().int().nonnegative().max(1_000_000_000).nullable().optional(),
});

export type AiFilterProposal = z.infer<typeof aiFilterSchema>;
