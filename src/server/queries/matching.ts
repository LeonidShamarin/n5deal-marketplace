import "server-only";

import { db } from "@/lib/db";
import { scoreMatch, type MatchResult } from "@/lib/matching";
import { PUBLIC_ASSET_WHERE, type AssetCardData } from "@/server/queries/assets";
import type { BuyerCardData } from "@/server/queries/buyers";

/**
 * Ranking one side of the marketplace against the other.
 *
 * The scoring itself is a pure function; this module only decides which rows to
 * score. It does so in memory, over a bounded candidate set, for a deliberate
 * reason: the score weighs five factors with partial credit near the edges, and
 * expressing that as SQL would either flatten it into a crude boolean filter or
 * turn into a query nobody can maintain. At this size — tens of published
 * listings, tens of mandates — the honest version is also the fast one.
 *
 * The candidate set is capped so this stays true. If the marketplace grew, the
 * fix is a pre-filter in SQL on the hard constraints (category, country,
 * price band) feeding the same scoring function, not a rewrite of the score.
 */

const CANDIDATE_LIMIT = 200;

export type ScoredAsset = { asset: AssetCardData; match: MatchResult };
export type ScoredBuyer = { buyer: BuyerCardData; match: MatchResult };

const assetSelect = {
  id: true,
  ref: true,
  title: true,
  description: true,
  category: true,
  licenseType: true,
  country: true,
  regulator: true,
  businessStatus: true,
  benefits: true,
  askingPrice: true,
  currency: true,
  employees: true,
  yearOfIssue: true,
  status: true,
  viewCount: true,
  publishedAt: true,
  createdAt: true,
  seller: {
    select: {
      id: true,
      name: true,
      sellerProfile: { select: { company: true, verified: true } },
    },
  },
} as const;

/** The listings that best fit a buyer's mandate. */
export async function assetsForMandate(
  buyerUserId: string,
  take = 5,
): Promise<ScoredAsset[]> {
  const mandate = await db.buyerProfile.findUnique({
    where: { userId: buyerUserId },
    select: {
      targetCategories: true,
      targetCountries: true,
      targetLicenseTypes: true,
      ticketMin: true,
      ticketMax: true,
      needsActiveLicense: true,
    },
  });

  if (!mandate) return [];

  const assets = await db.asset.findMany({
    where: PUBLIC_ASSET_WHERE,
    select: assetSelect,
    orderBy: { publishedAt: "desc" },
    take: CANDIDATE_LIMIT,
  });

  return assets
    .map((asset) => ({ asset, match: scoreMatch({ asset, mandate }) }))
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, take);
}

/** The buyers whose mandate best fits a given listing. */
export async function buyersForAsset(
  assetId: string,
  viewer: { verifiedSeller: boolean },
  take = 5,
): Promise<ScoredBuyer[]> {
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    select: {
      category: true,
      country: true,
      licenseType: true,
      businessStatus: true,
      askingPrice: true,
      benefits: true,
    },
  });

  if (!asset) return [];

  // The same visibility rule as the buyer catalogue: matching must not become a
  // side channel that reveals mandates a seller is not allowed to browse.
  const buyers = await db.buyerProfile.findMany({
    where: {
      user: { status: "ACTIVE" },
      visibility: viewer.verifiedSeller ? { in: ["PUBLIC", "VERIFIED_ONLY"] } : "PUBLIC",
    },
    select: {
      id: true,
      company: true,
      country: true,
      thesis: true,
      targetCategories: true,
      targetCountries: true,
      targetLicenseTypes: true,
      ticketMin: true,
      ticketMax: true,
      currency: true,
      needsActiveLicense: true,
      visibility: true,
      createdAt: true,
      user: { select: { id: true, name: true, status: true } },
    },
    take: CANDIDATE_LIMIT,
  });

  return buyers
    .map((buyer) => ({
      buyer,
      match: scoreMatch({ asset, mandate: buyer }),
    }))
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, take);
}
