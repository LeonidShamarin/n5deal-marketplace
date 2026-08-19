import "server-only";

import type { Prisma, Role } from "@prisma/client";

import { db } from "@/lib/db";
import { PAGE_SIZE, type BuyerFilters } from "@/lib/filters";

/**
 * Reading the buyer catalogue — the mirror image of the asset catalogue.
 *
 * Buyers control who can see them, so visibility is part of the query rather
 * than something the page decides afterwards:
 *
 *   PUBLIC         any signed-in seller, and managers
 *   VERIFIED_ONLY  only sellers carrying the platform's verified badge
 *   HIDDEN         nobody but the buyer themselves and managers
 *
 * A signed-out visitor sees no mandates at all: a list of who is buying what,
 * with budgets, is exactly the kind of thing that should not be scraped.
 */

const buyerCardSelect = {
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
} satisfies Prisma.BuyerProfileSelect;

export type BuyerCardData = Prisma.BuyerProfileGetPayload<{
  select: typeof buyerCardSelect;
}>;

export type BuyerViewer = {
  id: string;
  role: Role;
  /** Whether this viewer is a seller carrying the verified badge. */
  verifiedSeller: boolean;
};

/**
 * The visibility clause for a given viewer. Kept separate so the catalogue and
 * the single-profile lookup cannot drift apart on who is allowed to see what.
 */
export function buyerVisibilityWhere(viewer: BuyerViewer | null): Prisma.BuyerProfileWhereInput {
  // Not signed in: nothing.
  if (!viewer) return { id: "__none__" };

  if (viewer.role === "MANAGER") return {};

  const base: Prisma.BuyerProfileWhereInput = { user: { status: "ACTIVE" } };

  if (viewer.role === "SELLER") {
    return {
      ...base,
      visibility: viewer.verifiedSeller ? { in: ["PUBLIC", "VERIFIED_ONLY"] } : "PUBLIC",
    };
  }

  // A buyer browsing the buyer catalogue only ever sees their own entry, which
  // keeps the route from becoming a competitor list.
  return { ...base, userId: viewer.id };
}

export function buildBuyerWhere(
  filters: BuyerFilters,
  viewer: BuyerViewer | null,
): Prisma.BuyerProfileWhereInput {
  const and: Prisma.BuyerProfileWhereInput[] = [buyerVisibilityWhere(viewer)];

  // `hasSome` on the array columns: a mandate matches if it targets ANY of the
  // selected categories, which is what a facet means to a person.
  if (filters.categories.length > 0) {
    and.push({ targetCategories: { hasSome: filters.categories } });
  }
  if (filters.countries.length > 0) {
    and.push({ targetCountries: { hasSome: filters.countries } });
  }
  if (filters.licenseTypes.length > 0) {
    and.push({ targetLicenseTypes: { hasSome: filters.licenseTypes } });
  }
  if (filters.needsActiveLicense !== null) {
    and.push({ needsActiveLicense: filters.needsActiveLicense });
  }

  // Range OVERLAP, not containment: a seller with a EUR 3M asset wants every
  // buyer whose range covers 3M, not only buyers whose whole range sits inside
  // some window. An open end (null) means unbounded and always overlaps.
  if (filters.ticketMin !== null) {
    and.push({ OR: [{ ticketMax: null }, { ticketMax: { gte: filters.ticketMin } }] });
  }
  if (filters.ticketMax !== null) {
    and.push({ OR: [{ ticketMin: null }, { ticketMin: { lte: filters.ticketMax } }] });
  }

  if (filters.q !== "") {
    and.push({
      OR: [
        { company: { contains: filters.q, mode: "insensitive" } },
        { thesis: { contains: filters.q, mode: "insensitive" } },
        { about: { contains: filters.q, mode: "insensitive" } },
        { user: { name: { contains: filters.q, mode: "insensitive" } } },
      ],
    });
  }

  return { AND: and };
}

function buildBuyerOrderBy(
  sort: BuyerFilters["sort"],
): Prisma.BuyerProfileOrderByWithRelationInput[] {
  switch (sort) {
    case "ticketDesc":
      return [{ ticketMax: { sort: "desc", nulls: "last" } }, { id: "asc" }];
    case "ticketAsc":
      return [{ ticketMin: { sort: "asc", nulls: "last" } }, { id: "asc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

export type BuyerListResult = {
  items: BuyerCardData[];
  total: number;
  page: number;
  pageCount: number;
};

export async function listBuyers(
  filters: BuyerFilters,
  viewer: BuyerViewer | null,
): Promise<BuyerListResult> {
  const where = buildBuyerWhere(filters, viewer);

  const [total, items] = await Promise.all([
    db.buyerProfile.count({ where }),
    db.buyerProfile.findMany({
      where,
      select: buyerCardSelect,
      orderBy: buildBuyerOrderBy(filters.sort),
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return {
    items,
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Counts per target category, for the facet labels. */
export async function countBuyersByCategory(
  filters: BuyerFilters,
  viewer: BuyerViewer | null,
): Promise<{ total: number; byCategory: Record<string, number> }> {
  const where = buildBuyerWhere({ ...filters, categories: [] }, viewer);

  const [total, rows] = await Promise.all([
    db.buyerProfile.count({ where }),
    // Postgres cannot GROUP BY an array column in a way Prisma exposes, so the
    // counts are tallied in memory. The set is small and already filtered; if it
    // ever were not, this would become a lateral unnest in raw SQL.
    db.buyerProfile.findMany({ where, select: { targetCategories: true } }),
  ]);

  const byCategory: Record<string, number> = {};
  for (const row of rows) {
    for (const category of row.targetCategories) {
      byCategory[category] = (byCategory[category] ?? 0) + 1;
    }
  }

  return { total, byCategory };
}

export type BuyerDetail = Prisma.BuyerProfileGetPayload<{
  select: typeof buyerCardSelect & { about: true };
}>;

/** One mandate, subject to the same visibility rules as the list. */
export async function findBuyerProfile(
  id: string,
  viewer: BuyerViewer | null,
): Promise<BuyerDetail | null> {
  return db.buyerProfile.findFirst({
    where: { AND: [{ id }, buyerVisibilityWhere(viewer)] },
    select: { ...buyerCardSelect, about: true },
  });
}

/** Build the viewer descriptor the visibility rules need. */
export async function buyerViewerFor(
  user: { id: string; role: Role } | null,
): Promise<BuyerViewer | null> {
  if (!user) return null;
  if (user.role !== "SELLER") return { ...user, verifiedSeller: false };

  const profile = await db.sellerProfile.findUnique({
    where: { userId: user.id },
    select: { verified: true },
  });

  return { ...user, verifiedSeller: profile?.verified ?? false };
}
