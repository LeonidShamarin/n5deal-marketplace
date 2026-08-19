import type {
  AssetBenefit,
  BusinessCategory,
  BusinessStatus,
  LicenseType,
} from "@prisma/client";

import { countryName, CATEGORY_LABELS, LICENSE_LABELS } from "./vocabulary";

/**
 * How well a buyer mandate fits an asset.
 *
 * This is a pure function on purpose. It is the part of the "AI matching"
 * feature that decides anything: the model is only ever asked to put the result
 * into a sentence, never to produce the number. That keeps the ranking stable,
 * explainable and testable, and it means the feature still works with no API key
 * — you lose the prose, not the matching.
 *
 * The weights encode how this market actually behaves. A licence type in the
 * wrong jurisdiction is worthless, so country and licence carry more than a
 * broad category; price is a hard commercial constraint, so falling outside the
 * ticket range costs the most single component.
 */

export const MATCH_WEIGHTS = {
  category: 25,
  country: 25,
  licenseType: 20,
  ticket: 25,
  operatingRequirement: 5,
} as const;

export const MAX_MATCH_SCORE = Object.values(MATCH_WEIGHTS).reduce((a, b) => a + b, 0);

export type MatchInput = {
  asset: {
    category: BusinessCategory;
    country: string;
    licenseType: LicenseType;
    businessStatus: BusinessStatus;
    askingPrice: bigint;
    benefits: AssetBenefit[];
  };
  mandate: {
    targetCategories: BusinessCategory[];
    targetCountries: string[];
    targetLicenseTypes: LicenseType[];
    ticketMin: bigint | null;
    ticketMax: bigint | null;
    needsActiveLicense: boolean;
  };
};

export type MatchFactor = {
  key: keyof typeof MATCH_WEIGHTS;
  /** Points awarded, out of the weight for this factor. */
  points: number;
  weight: number;
  hit: boolean;
  /** Plain-language statement of what happened, used in the UI and the prompt. */
  detail: string;
};

export type MatchResult = {
  /** 0-100. */
  score: number;
  factors: MatchFactor[];
  /** The factors that scored, best first — the "why it fits" list. */
  strengths: MatchFactor[];
  /** The factors that did not — the "why it might not" list. */
  gaps: MatchFactor[];
};

export function scoreMatch({ asset, mandate }: MatchInput): MatchResult {
  const factors: MatchFactor[] = [];

  // --- Category -----------------------------------------------------------
  // An empty target list means "no preference", which is a soft yes rather than
  // a miss: a buyer who did not narrow anything should not be scored as a bad
  // fit for everything.
  const categoryOpen = mandate.targetCategories.length === 0;
  const categoryHit = categoryOpen || mandate.targetCategories.includes(asset.category);
  factors.push({
    key: "category",
    weight: MATCH_WEIGHTS.category,
    points: categoryHit
      ? categoryOpen
        ? MATCH_WEIGHTS.category * 0.6
        : MATCH_WEIGHTS.category
      : 0,
    hit: categoryHit,
    detail: categoryOpen
      ? "The mandate names no target sector, so the sector is not a constraint."
      : categoryHit
        ? `${CATEGORY_LABELS[asset.category]} is on the mandate's target list.`
        : `The mandate targets ${mandate.targetCategories.map((c) => CATEGORY_LABELS[c]).join(", ")}, not ${CATEGORY_LABELS[asset.category]}.`,
  });

  // --- Country ------------------------------------------------------------
  const countryOpen = mandate.targetCountries.length === 0;
  const countryHit = countryOpen || mandate.targetCountries.includes(asset.country);
  factors.push({
    key: "country",
    weight: MATCH_WEIGHTS.country,
    points: countryHit
      ? countryOpen
        ? MATCH_WEIGHTS.country * 0.6
        : MATCH_WEIGHTS.country
      : 0,
    hit: countryHit,
    detail: countryOpen
      ? "The mandate names no target jurisdiction."
      : countryHit
        ? `${countryName(asset.country)} is a target jurisdiction for this buyer.`
        : `The buyer targets ${mandate.targetCountries.map(countryName).join(", ")} — ${countryName(asset.country)} is outside that.`,
  });

  // --- Licence type -------------------------------------------------------
  const licenceOpen = mandate.targetLicenseTypes.length === 0;
  const licenceHit =
    licenceOpen || mandate.targetLicenseTypes.includes(asset.licenseType);
  factors.push({
    key: "licenseType",
    weight: MATCH_WEIGHTS.licenseType,
    points: licenceHit
      ? licenceOpen
        ? MATCH_WEIGHTS.licenseType * 0.6
        : MATCH_WEIGHTS.licenseType
      : 0,
    hit: licenceHit,
    detail: licenceOpen
      ? "The mandate does not restrict the licence type."
      : licenceHit
        ? `A ${LICENSE_LABELS[asset.licenseType]} licence is what the mandate asks for.`
        : `The mandate asks for ${mandate.targetLicenseTypes.map((l) => LICENSE_LABELS[l]).join(", ")}, not ${LICENSE_LABELS[asset.licenseType]}.`,
  });

  // --- Ticket size --------------------------------------------------------
  // Partial credit near the edges: a price 10% over the ceiling is a
  // negotiation, not a rejection, and scoring it zero would hide obvious deals.
  const ticket = scoreTicket(asset.askingPrice, mandate.ticketMin, mandate.ticketMax);
  factors.push({
    key: "ticket",
    weight: MATCH_WEIGHTS.ticket,
    points: MATCH_WEIGHTS.ticket * ticket.fraction,
    hit: ticket.fraction >= 1,
    detail: ticket.detail,
  });

  // --- Operating requirement ---------------------------------------------
  const operatingOk = !mandate.needsActiveLicense || asset.businessStatus === "ACTIVE";
  factors.push({
    key: "operatingRequirement",
    weight: MATCH_WEIGHTS.operatingRequirement,
    points: operatingOk ? MATCH_WEIGHTS.operatingRequirement : 0,
    hit: operatingOk,
    detail: !mandate.needsActiveLicense
      ? "The buyer accepts a licence with no operations."
      : operatingOk
        ? "The buyer requires an operating business, and this one is operating."
        : "The buyer requires an operating business; this is a licence only.",
  });

  const total = factors.reduce((sum, factor) => sum + factor.points, 0);
  const score = Math.round((total / MAX_MATCH_SCORE) * 100);

  const byImportance = (a: MatchFactor, b: MatchFactor) => b.weight - a.weight;

  return {
    score,
    factors,
    strengths: factors.filter((f) => f.points > 0).sort(byImportance),
    gaps: factors.filter((f) => !f.hit).sort(byImportance),
  };
}

function scoreTicket(
  price: bigint,
  min: bigint | null,
  max: bigint | null,
): { fraction: number; detail: string } {
  if (min === null && max === null) {
    return { fraction: 0.6, detail: "The mandate states no budget range." };
  }

  if (min !== null && price < min) {
    // Below the floor is rarely a dealbreaker — it usually just means the buyer
    // is aiming larger — so it keeps more credit than being over budget.
    const ratio = Number(price) / Number(min);
    return {
      fraction: clamp(0.4 + ratio * 0.3, 0, 0.7),
      detail: "The asking price is below the buyer's stated minimum ticket.",
    };
  }

  if (max !== null && price > max) {
    const overshoot = Number(price - max) / Number(max);
    if (overshoot <= 0.2) {
      return {
        fraction: 0.5,
        detail:
          "The asking price is slightly above the buyer's ceiling — within negotiating distance.",
      };
    }
    return {
      fraction: clamp(0.3 - overshoot * 0.1, 0, 0.3),
      detail: "The asking price is well above the buyer's ceiling.",
    };
  }

  return {
    fraction: 1,
    detail: "The asking price sits inside the buyer's ticket range.",
  };
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** Coarse band used for the badge colour and for sorting groups in the UI. */
export function matchBand(score: number): "strong" | "possible" | "weak" {
  if (score >= 75) return "strong";
  if (score >= 50) return "possible";
  return "weak";
}
