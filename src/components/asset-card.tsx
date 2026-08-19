import { BadgeCheck, Eye } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { CountryLabel, CountryTile } from "@/components/ui/country";
import { AttributeCell, Badge, Card, Chip } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { formatMoneyCompact } from "@/lib/money";
import type { AssetCardData } from "@/server/queries/assets";
import {
  ASSET_STATUS_LABELS,
  BENEFIT_LABELS,
  BUSINESS_STATUS_LABELS,
  CATEGORY_LABELS,
  LICENSE_LABELS,
} from "@/lib/vocabulary";

/** How many benefit chips fit before the row starts wrapping badly. */
const VISIBLE_BENEFITS = 3;

/**
 * The listing card, rebuilt from n5deal.com.
 *
 * The reference does something worth copying: every fact about an asset is a
 * labelled cell in a grid, not a sentence. Two listings side by side are then
 * directly comparable, and the asking price — the one number a buyer scans for —
 * is the only cell that carries a tint.
 *
 * `showStatus` is for the seller's own dashboard, where a card must say DRAFT or
 * SOLD. The public catalogue never renders it, because everything there is
 * published by definition.
 */
export function AssetCard({
  asset,
  showStatus = false,
}: {
  asset: AssetCardData;
  showStatus?: boolean;
}) {
  const t = useTranslations("asset");
  const locale = useLocale();

  const visible = asset.benefits.slice(0, VISIBLE_BENEFITS);
  const overflow = asset.benefits.length - visible.length;
  const verified = asset.seller.sellerProfile?.verified ?? false;
  const na = t("notSpecified");

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex gap-4">
        {/* Jurisdiction tile — see vocabulary.ts on why this is not a flag. */}
        <CountryTile code={asset.country} className="hidden h-16 w-24 sm:grid" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="truncate text-[18px] font-bold leading-tight text-ink">
              {t("idLabel", { ref: asset.ref })}
            </h3>

            <div className="flex shrink-0 items-center gap-2">
              {showStatus ? (
                <Badge tone={statusTone(asset.status)}>
                  {ASSET_STATUS_LABELS[asset.status]}
                </Badge>
              ) : null}
              {verified ? (
                <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-success">
                  <BadgeCheck className="h-4 w-4" aria-hidden />
                  {t("validated")}
                </span>
              ) : null}
            </div>
          </div>

          <p className="mt-0.5 truncate text-[14px] text-muted">{asset.title}</p>

          {/* Row one: what the asset is, and what it costs. */}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <AttributeCell
              label={t("country")}
              value={<CountryLabel code={asset.country} />}
            />
            <AttributeCell
              label={t("licenseType")}
              value={LICENSE_LABELS[asset.licenseType]}
            />
            <AttributeCell
              label={t("category")}
              value={CATEGORY_LABELS[asset.category]}
            />
            <AttributeCell
              label={t("businessStatus")}
              value={BUSINESS_STATUS_LABELS[asset.businessStatus]}
              tone={asset.businessStatus === "ACTIVE" ? "success" : "danger"}
            />
            <AttributeCell
              label={t("askingPrice")}
              value={formatMoneyCompact(asset.askingPrice, asset.currency, locale)}
              emphasis
            />
          </div>

          {/* Row two: the details that decide a shortlist. */}
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <AttributeCell
              label={t("employees")}
              value={asset.employees ?? na}
              tone="muted"
            />
            <AttributeCell
              label={t("yearOfIssue")}
              value={asset.yearOfIssue ?? na}
              tone="muted"
            />
            <AttributeCell
              label={t("regulator")}
              value={asset.regulator ?? na}
              tone="muted"
            />
          </div>

          {asset.benefits.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[13px] text-muted">{t("included")}</span>
              {visible.map((benefit) => (
                <Chip key={benefit}>{BENEFIT_LABELS[benefit]}</Chip>
              ))}
              {overflow > 0 ? (
                <span className="text-[13px] font-bold text-brand">
                  {t("moreBenefits", { count: overflow })}
                </span>
              ) : null}
            </div>
          ) : null}

          <p className="mt-3 line-clamp-2-safe text-[14px] leading-relaxed text-muted">
            {asset.description}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-[13px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Eye className="h-4 w-4" aria-hidden />
                {t("views", { count: asset.viewCount })}
              </span>
              <span className="truncate">
                {asset.seller.sellerProfile?.company ?? asset.seller.name}
              </span>
            </div>

            <Link href={`/assets/${asset.ref}`}>
              <Button size="sm" variant="outline">
                {t("view")}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}

function statusTone(status: AssetCardData["status"]) {
  switch (status) {
    case "PUBLISHED":
      return "success" as const;
    case "DRAFT":
      return "neutral" as const;
    case "SUSPENDED":
      return "danger" as const;
    case "SOLD":
      return "brand" as const;
    case "ARCHIVED":
    default:
      return "warning" as const;
  }
}

/** The card's skeleton, so a slow query shows structure instead of a blank page. */
export function AssetCardSkeleton() {
  return (
    <Card className="p-5">
      <div className="flex gap-4">
        <div className="hidden h-16 w-24 shrink-0 rounded-xl bg-panel sm:block" />
        <div className="flex-1 space-y-3">
          <div className="h-5 w-40 rounded bg-panel" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-12 rounded-[var(--radius-cell)] bg-panel" />
            ))}
          </div>
          <div className="h-4 w-3/4 rounded bg-panel" />
          <div className="h-4 w-1/2 rounded bg-panel" />
        </div>
      </div>
    </Card>
  );
}
