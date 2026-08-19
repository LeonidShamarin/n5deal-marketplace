import { PackageSearch } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { Prisma } from "@prisma/client";

import { SearchBox } from "@/components/catalogue/controls";
import { ModerationActions } from "@/components/moderation-actions";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatMoneyCompact } from "@/lib/money";
import { requireRole } from "@/lib/session";
import {
  ASSET_STATUS_LABELS,
  CATEGORY_LABELS,
  LICENSE_LABELS,
  USER_STATUS_LABELS,
  countryName,
} from "@/lib/vocabulary";

export const metadata: Metadata = { title: "Listings" };

const PAGE_SIZE = 25;

/**
 * Listings, moderated independently of their owner.
 *
 * A single bad listing should not cost a seller their whole account, so
 * suspension works at both levels and they do not interfere: the row here shows
 * the listing's own status alongside its seller's, which is what makes the
 * difference visible — a listing can read PUBLISHED while being invisible to the
 * public because its seller is suspended.
 */
export default async function ModerationAssetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("MANAGER");

  const params = await searchParams;
  const q = String(params.q ?? "")
    .trim()
    .slice(0, 120);
  const status = String(params.status ?? "");

  const [t, tc, format, locale] = await Promise.all([
    getTranslations("moderation"),
    getTranslations("common"),
    getFormatter(),
    getLocale(),
  ]);

  const validStatuses = ["DRAFT", "PUBLISHED", "SUSPENDED", "SOLD", "ARCHIVED"];

  const where: Prisma.AssetWhereInput = {
    AND: [
      validStatuses.includes(status)
        ? { status: status as Prisma.AssetWhereInput["status"] }
        : {},
      q === ""
        ? {}
        : {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { seller: { name: { contains: q, mode: "insensitive" } } },
              {
                seller: {
                  sellerProfile: { company: { contains: q, mode: "insensitive" } },
                },
              },
            ],
          },
    ],
  };

  const assets = await db.asset.findMany({
    where,
    orderBy: [{ status: "asc" }, { ref: "desc" }],
    take: PAGE_SIZE,
    select: {
      id: true,
      ref: true,
      title: true,
      status: true,
      previousStatus: true,
      statusReason: true,
      statusChangedAt: true,
      category: true,
      licenseType: true,
      country: true,
      askingPrice: true,
      currency: true,
      seller: {
        select: {
          name: true,
          status: true,
          sellerProfile: { select: { company: true } },
        },
      },
    },
  });

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <SearchBox placeholder={t("searchAssets")} />
        <div className="border-line bg-panel flex flex-wrap items-center gap-1 rounded-full border p-1">
          {["", ...validStatuses].map((value) => {
            const active = status === value;
            return (
              <Link
                key={value || "all"}
                href={
                  value === ""
                    ? "/moderation/assets"
                    : `/moderation/assets?status=${value}`
                }
                className={
                  active
                    ? "bg-ink rounded-full px-3 py-1.5 text-[13px] font-semibold text-white"
                    : "text-muted hover:text-ink rounded-full px-3 py-1.5 text-[13px] font-semibold"
                }
              >
                {value === ""
                  ? tc("all")
                  : ASSET_STATUS_LABELS[value as keyof typeof ASSET_STATUS_LABELS]}
              </Link>
            );
          })}
        </div>
      </div>

      <p className="text-muted mt-4 text-[14px]">
        {tc("results", { count: assets.length })}
      </p>

      {assets.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={<PackageSearch className="h-8 w-8" />}
            title={t("noAssets")}
            description={t("noAssetsHint")}
          />
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {assets.map((asset) => {
            const hiddenBySeller =
              asset.status === "PUBLISHED" && asset.seller.status !== "ACTIVE";

            return (
              <li key={asset.id}>
                <Card
                  className={
                    asset.status === "SUSPENDED" ? "border-danger/20 p-4" : "p-4"
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/assets/${asset.ref}`}
                          className="text-ink hover:text-brand text-[15px] font-bold"
                        >
                          #{asset.ref}
                        </Link>
                        <Badge
                          tone={asset.status === "PUBLISHED" ? "success" : "neutral"}
                        >
                          {ASSET_STATUS_LABELS[asset.status]}
                        </Badge>
                        {hiddenBySeller ? (
                          <Badge tone="warning">
                            {t("hiddenBySeller", {
                              status: USER_STATUS_LABELS[asset.seller.status],
                            })}
                          </Badge>
                        ) : null}
                      </div>

                      <p className="text-ink mt-0.5 truncate text-[15px]">
                        {asset.title}
                      </p>
                      <p className="text-muted mt-0.5 truncate text-[13px]">
                        {asset.seller.sellerProfile?.company ?? asset.seller.name} ·{" "}
                        {CATEGORY_LABELS[asset.category]} ·{" "}
                        {LICENSE_LABELS[asset.licenseType]} · {countryName(asset.country)}{" "}
                        · {formatMoneyCompact(asset.askingPrice, asset.currency, locale)}
                      </p>

                      {asset.statusReason ? (
                        <p className="bg-danger-soft text-danger mt-2 rounded-lg px-2.5 py-1.5 text-[13px]">
                          {asset.statusReason}
                          {asset.statusChangedAt
                            ? ` — ${format.relativeTime(asset.statusChangedAt)}`
                            : ""}
                          {asset.previousStatus
                            ? ` · ${t("willRestoreTo", {
                                status: ASSET_STATUS_LABELS[asset.previousStatus],
                              })}`
                            : ""}
                        </p>
                      ) : null}
                    </div>

                    <ModerationActions
                      targetId={asset.id}
                      actions={
                        asset.status === "SUSPENDED"
                          ? [{ kind: "unsuspendAsset", label: t("unsuspend") }]
                          : [
                              {
                                kind: "suspendAsset",
                                label: t("suspend"),
                                danger: true,
                              },
                            ]
                      }
                    />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
