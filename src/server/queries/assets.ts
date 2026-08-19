import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { PAGE_SIZE, type AssetFilters } from "@/lib/filters";

/**
 * Reading the asset catalogue.
 *
 * One rule governs this whole file: **an asset is public only if it is PUBLISHED
 * and its seller is ACTIVE.** That is the cascade the assignment asks for, and
 * it is expressed as a join condition rather than by writing to the assets when
 * a seller is suspended. The difference matters — suspending a seller must not
 * touch their assets, so that unsuspending restores the exact prior state
 * instead of guessing that everything used to be published.
 */
export const PUBLIC_ASSET_WHERE = {
  status: "PUBLISHED",
  seller: { status: "ACTIVE" },
} as const satisfies Prisma.AssetWhereInput;

/** The fields a card needs — nothing more, so a list of 12 stays one small query. */
const cardSelect = {
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
} satisfies Prisma.AssetSelect;

export type AssetCardData = Prisma.AssetGetPayload<{ select: typeof cardSelect }>;

/**
 * Turn the parsed URL state into a Prisma filter.
 *
 * Every condition is added only when the user actually chose something, so an
 * untouched facet contributes nothing to the query instead of an `in: []` that
 * would silently match nothing.
 */
export function buildAssetWhere(
  filters: AssetFilters,
  base: Prisma.AssetWhereInput = PUBLIC_ASSET_WHERE,
): Prisma.AssetWhereInput {
  const and: Prisma.AssetWhereInput[] = [base];

  if (filters.categories.length > 0) and.push({ category: { in: filters.categories } });
  if (filters.countries.length > 0) and.push({ country: { in: filters.countries } });
  if (filters.licenseTypes.length > 0) {
    and.push({ licenseType: { in: filters.licenseTypes } });
  }
  if (filters.businessStatuses.length > 0) {
    and.push({ businessStatus: { in: filters.businessStatuses } });
  }

  if (filters.priceMin !== null) and.push({ askingPrice: { gte: filters.priceMin } });
  if (filters.priceMax !== null) and.push({ askingPrice: { lte: filters.priceMax } });

  if (filters.q !== "") {
    // Substring matching across the fields a person would search by. It is not a
    // real full-text index — see the README on pg_trgm — but it is honest about
    // what it does and it runs in the database rather than in the page.
    and.push({
      OR: [
        { title: { contains: filters.q, mode: "insensitive" } },
        { description: { contains: filters.q, mode: "insensitive" } },
        { regulator: { contains: filters.q, mode: "insensitive" } },
        {
          seller: {
            sellerProfile: { company: { contains: filters.q, mode: "insensitive" } },
          },
        },
      ],
    });
  }

  return { AND: and };
}

function buildAssetOrderBy(
  sort: AssetFilters["sort"],
): Prisma.AssetOrderByWithRelationInput[] {
  switch (sort) {
    case "priceAsc":
      return [{ askingPrice: "asc" }, { ref: "asc" }];
    case "priceDesc":
      return [{ askingPrice: "desc" }, { ref: "asc" }];
    case "popular":
      return [{ viewCount: "desc" }, { ref: "asc" }];
    case "newest":
    default:
      // `ref` breaks ties so that pagination is stable: without a unique
      // tiebreaker, two rows with the same timestamp can swap between pages and
      // an item shows up twice or not at all.
      return [{ publishedAt: "desc" }, { ref: "desc" }];
  }
}

export type AssetListResult = {
  items: AssetCardData[];
  total: number;
  page: number;
  pageCount: number;
};

export async function listPublicAssets(filters: AssetFilters): Promise<AssetListResult> {
  const where = buildAssetWhere(filters);

  const [total, items] = await Promise.all([
    db.asset.count({ where }),
    db.asset.findMany({
      where,
      select: cardSelect,
      orderBy: buildAssetOrderBy(filters.sort),
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return { items, total, page: filters.page, pageCount };
}

/**
 * Counts per category for the tab strip, in the style of the reference site's
 * "Payment (59)".
 *
 * The category facet itself is excluded from the counting filter — otherwise
 * picking "Crypto" would show "Crypto (23)" and zero for everything else, and
 * the strip would stop being a way to move between categories.
 */
export async function countAssetsByCategory(
  filters: AssetFilters,
): Promise<{ total: number; byCategory: Record<string, number> }> {
  const where = buildAssetWhere({ ...filters, categories: [] });

  const [total, grouped] = await Promise.all([
    db.asset.count({ where }),
    db.asset.groupBy({ by: ["category"], where, _count: { _all: true } }),
  ]);

  const byCategory: Record<string, number> = {};
  for (const row of grouped) byCategory[row.category] = row._count._all;

  return { total, byCategory };
}

/**
 * One asset by its human-facing reference number.
 *
 * Returns a discriminated result instead of null, because "does not exist" and
 * "exists but its owner was removed" deserve different pages: the first is a
 * 404, the second is a listing that genuinely was here and is not any more.
 */
export type AssetDetail = Prisma.AssetGetPayload<{
  include: {
    seller: {
      select: {
        id: true;
        name: true;
        status: true;
        sellerProfile: true;
      };
    };
  };
}>;

export type AssetLookup =
  | { kind: "ok"; asset: AssetDetail }
  | { kind: "gone"; asset: AssetDetail }
  | { kind: "missing" };

export async function findAssetByRef(
  ref: number,
  viewer: { id: string; role: string } | null,
): Promise<AssetLookup> {
  const asset = await db.asset.findUnique({
    where: { ref },
    include: {
      seller: {
        select: { id: true, name: true, status: true, sellerProfile: true },
      },
    },
  });

  if (!asset) return { kind: "missing" };

  const isOwner = viewer?.id === asset.sellerId;
  const isManager = viewer?.role === "MANAGER";

  // The owner and a manager see the listing in any state — that is the whole
  // point of a draft, and a manager cannot moderate what they cannot open.
  if (isOwner || isManager) return { kind: "ok", asset };

  // Removed seller: the listing existed and is now withdrawn along with its
  // owner. A dedicated page beats both a 404 (which denies it ever existed) and
  // a crash on a half-loaded relation.
  if (asset.seller.status === "REMOVED") return { kind: "gone", asset };

  // Suspended seller, or a listing that is not published: to everyone else these
  // are indistinguishable from a listing that never existed.
  if (asset.seller.status !== "ACTIVE" || asset.status !== "PUBLISHED") {
    return { kind: "missing" };
  }

  return { kind: "ok", asset };
}

/**
 * Bump the view counter without blocking the render.
 *
 * `updateMany` rather than `update` so that a race with a concurrent delete
 * cannot throw a "record not found" at a reader who did nothing wrong.
 */
export async function recordAssetView(id: string): Promise<void> {
  await db.asset
    .updateMany({ where: { id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {
      // A missed view count is not worth failing a page render over.
    });
}
