/**
 * The shared attribute vocabulary of the marketplace.
 *
 * This module is the single place where the domain enums get human-readable
 * labels. Both sides of the marketplace read from it: an asset says "I am an EMI
 * in Lithuania", a buyer mandate says "I want an EMI in Lithuania", the facets
 * render from the same lists, and the matching function compares the same
 * values. Adding a new licence type therefore means editing one file.
 *
 * Every label map is typed as `Record<Enum, string>`, so extending a Prisma enum
 * without adding its label is a compile error rather than an "undefined" in the UI.
 */

import type {
  AssetBenefit,
  AssetStatus,
  BusinessCategory,
  BusinessStatus,
  BuyerVisibility,
  Currency,
  LicenseType,
  Role,
  UserStatus,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Categories, licences, benefits
// ---------------------------------------------------------------------------

export const BUSINESS_CATEGORIES = [
  "PAYMENTS",
  "FINTECH",
  "CRYPTO",
  "BANKING",
  "EMONEY",
  "FOREX",
  "LENDING",
  "GAMBLING",
] as const satisfies readonly BusinessCategory[];

export const CATEGORY_LABELS: Record<BusinessCategory, string> = {
  PAYMENTS: "Payments",
  FINTECH: "Fintech",
  CRYPTO: "Crypto",
  BANKING: "Banking",
  EMONEY: "E-money",
  FOREX: "Forex",
  LENDING: "Lending",
  GAMBLING: "Gambling",
};

export const LICENSE_TYPES = [
  "MSO",
  "SEMI",
  "EMI",
  "PI",
  "API_LICENSE",
  "BANK",
  "VASP",
  "MTL",
] as const satisfies readonly LicenseType[];

export const LICENSE_LABELS: Record<LicenseType, string> = {
  MSO: "MSO",
  SEMI: "SEMI",
  EMI: "EMI",
  PI: "PI",
  API_LICENSE: "API",
  BANK: "Bank",
  VASP: "VASP",
  MTL: "MTL",
};

/** Spelled out for tooltips and the listing form, where the acronym is not enough. */
export const LICENSE_DESCRIPTIONS: Record<LicenseType, string> = {
  MSO: "Money Services Operator",
  SEMI: "Small Electronic Money Institution",
  EMI: "Electronic Money Institution",
  PI: "Payment Institution",
  API_LICENSE: "Authorised Payment Institution",
  BANK: "Banking licence",
  VASP: "Virtual Asset Service Provider",
  MTL: "Money Transmitter License",
};

export const BUSINESS_STATUSES = [
  "ACTIVE",
  "LICENSE_ONLY",
] as const satisfies readonly BusinessStatus[];

export const BUSINESS_STATUS_LABELS: Record<BusinessStatus, string> = {
  ACTIVE: "Active business",
  LICENSE_ONLY: "License only",
};

export const ASSET_BENEFITS = [
  "IBAN",
  "SWIFT",
  "SEPA",
  "ACQUIRING",
  "CARD_ISSUING",
  "STAFF",
  "SOFTWARE",
  "CLIENT_BASE",
  "BANK_ACCOUNTS",
  "OFFICE",
] as const satisfies readonly AssetBenefit[];

export const BENEFIT_LABELS: Record<AssetBenefit, string> = {
  IBAN: "IBAN issuing",
  SWIFT: "SWIFT",
  SEPA: "SEPA",
  ACQUIRING: "Acquiring",
  CARD_ISSUING: "Card issuing",
  STAFF: "Trained staff",
  SOFTWARE: "Software / core",
  CLIENT_BASE: "Client base",
  BANK_ACCOUNTS: "Bank accounts",
  OFFICE: "Office & premises",
};

// ---------------------------------------------------------------------------
// Lifecycle labels
// ---------------------------------------------------------------------------

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  SUSPENDED: "Suspended",
  SOLD: "Sold",
  ARCHIVED: "Archived",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  REMOVED: "Removed",
};

export const ROLE_LABELS: Record<Role, string> = {
  BUYER: "Buyer",
  SELLER: "Seller",
  MANAGER: "Platform manager",
};

export const VISIBILITY_LABELS: Record<BuyerVisibility, string> = {
  PUBLIC: "Visible to all sellers",
  VERIFIED_ONLY: "Verified sellers only",
  HIDDEN: "Hidden from sellers",
};

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export const CURRENCIES = ["EUR", "USD", "GBP"] as const satisfies readonly Currency[];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
};

// ---------------------------------------------------------------------------
// Countries
// ---------------------------------------------------------------------------

/**
 * A curated list rather than all 249 ISO entries: these are the jurisdictions
 * that actually appear in licence deals, and a short list keeps the country
 * facet usable without a search box inside it.
 */
export const COUNTRIES: ReadonlyArray<{ code: string; name: string }> = [
  { code: "AE", name: "United Arab Emirates" },
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "BG", name: "Bulgaria" },
  { code: "CA", name: "Canada" },
  { code: "CH", name: "Switzerland" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czechia" },
  { code: "DE", name: "Germany" },
  { code: "DK", name: "Denmark" },
  { code: "EE", name: "Estonia" },
  { code: "ES", name: "Spain" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GB", name: "United Kingdom" },
  { code: "GI", name: "Gibraltar" },
  { code: "HK", name: "Hong Kong" },
  { code: "IE", name: "Ireland" },
  { code: "IT", name: "Italy" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "LV", name: "Latvia" },
  { code: "MT", name: "Malta" },
  { code: "NL", name: "Netherlands" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Romania" },
  { code: "SE", name: "Sweden" },
  { code: "SG", name: "Singapore" },
  { code: "SI", name: "Slovenia" },
  { code: "SK", name: "Slovakia" },
  { code: "US", name: "United States" },
];

const COUNTRY_NAME_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c.name]));

export const COUNTRY_CODES: readonly string[] = COUNTRIES.map((c) => c.code);

export function countryName(code: string): string {
  return COUNTRY_NAME_BY_CODE.get(code.toUpperCase()) ?? code.toUpperCase();
}

/**
 * Jurisdictions are shown as their ISO code, not as a flag.
 *
 * Flag emoji were the first attempt and had to go: Windows ships no glyphs for
 * the regional-indicator block, so Chrome there renders "🇨🇭" as the bare letters
 * "CH" — a broken-looking tile on the exact machine a reviewer is likely to use.
 * The alternatives were an image CDN (an external dependency for decoration) or
 * ~30 bundled SVGs. The code renders identically everywhere and is what the
 * listings are actually filtered by.
 */
export function countryCode(code: string): string {
  return code.toUpperCase();
}

export function isKnownCountry(code: string): boolean {
  return COUNTRY_NAME_BY_CODE.has(code.toUpperCase());
}

/** Regulators offered as suggestions in the listing form, keyed by jurisdiction. */
export const REGULATORS_BY_COUNTRY: Readonly<Record<string, readonly string[]>> = {
  GB: ["FCA"],
  LT: ["Bank of Lithuania"],
  MT: ["MFSA"],
  CY: ["CySEC", "Central Bank of Cyprus"],
  EE: ["Estonian FSA"],
  IE: ["Central Bank of Ireland"],
  LU: ["CSSF"],
  NL: ["DNB", "AFM"],
  DE: ["BaFin"],
  FR: ["ACPR"],
  ES: ["Banco de España", "CNMV"],
  PL: ["KNF"],
  CZ: ["CNB"],
  CH: ["FINMA"],
  AE: ["DFSA", "VARA"],
  SG: ["MAS"],
  HK: ["HKMA", "SFC"],
  US: ["FinCEN", "NYDFS"],
  CA: ["FINTRAC"],
  GI: ["GFSC"],
};
