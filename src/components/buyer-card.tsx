import { EyeOff, Target } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { CountryTile } from "@/components/ui/country";
import { AttributeCell, Badge, Card, Chip } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { formatRange } from "@/lib/money";
import type { BuyerCardData } from "@/server/queries/buyers";
import {
  CATEGORY_LABELS,
  LICENSE_LABELS,
  VISIBILITY_LABELS,
  countryName,
} from "@/lib/vocabulary";

const VISIBLE_TAGS = 4;

/**
 * A buyer mandate rendered in the same shape as an asset card.
 *
 * That is the point of the symmetry: a seller scanning buyers reads the same
 * grid of labelled cells they already know from the listings, and the fields
 * line up one-to-one — the asset says "I am an EMI in Lithuania at EUR 2M", the
 * mandate says "I want an EMI in Lithuania around EUR 1-6M".
 */
export function BuyerCard({
  buyer,
  showVisibility = false,
  matchScore,
}: {
  buyer: BuyerCardData;
  /** Shown on the buyer's own dashboard and to managers. */
  showVisibility?: boolean;
  /** Set when the card is rendered in the context of a specific asset. */
  matchScore?: number;
}) {
  const t = useTranslations("buyer");
  const tc = useTranslations("common");
  const locale = useLocale();

  const categories = buyer.targetCategories.slice(0, VISIBLE_TAGS);
  const categoryOverflow = buyer.targetCategories.length - categories.length;
  const countries = buyer.targetCountries.slice(0, VISIBLE_TAGS);
  const countryOverflow = buyer.targetCountries.length - countries.length;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex gap-4">
        <CountryTile code={buyer.country} className="hidden h-16 w-24 sm:grid" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-ink truncate text-[18px] leading-tight font-bold">
                {buyer.company}
              </h3>
              <p className="text-muted truncate text-[14px]">
                {buyer.user.name} · {countryName(buyer.country)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {matchScore !== undefined ? (
                <Badge
                  tone={
                    matchScore >= 75 ? "success" : matchScore >= 50 ? "brand" : "neutral"
                  }
                >
                  <Target className="h-3.5 w-3.5" aria-hidden />
                  {matchScore}%
                </Badge>
              ) : null}
              {showVisibility ? (
                <Badge tone={buyer.visibility === "HIDDEN" ? "danger" : "neutral"}>
                  {buyer.visibility === "HIDDEN" ? (
                    <EyeOff className="h-3.5 w-3.5" aria-hidden />
                  ) : null}
                  {VISIBILITY_LABELS[buyer.visibility]}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <AttributeCell
              label={t("ticketSize")}
              value={formatRange(
                buyer.ticketMin,
                buyer.ticketMax,
                buyer.currency,
                locale,
              )}
              emphasis
            />
            <AttributeCell
              label={t("targetLicenses")}
              value={
                buyer.targetLicenseTypes.length > 0
                  ? buyer.targetLicenseTypes.map((l) => LICENSE_LABELS[l]).join(", ")
                  : tc("any")
              }
            />
            <AttributeCell
              label={t("needsActiveLicense")}
              value={
                buyer.needsActiveLicense
                  ? t("operatingRequired")
                  : t("operatingNotRequired")
              }
              tone={buyer.needsActiveLicense ? "success" : "muted"}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-muted text-[13px]">{t("targetCategories")}</span>
            {categories.length === 0 ? (
              <span className="text-faint text-[13px]">{tc("any")}</span>
            ) : (
              categories.map((category) => (
                <Chip key={category}>{CATEGORY_LABELS[category]}</Chip>
              ))
            )}
            {categoryOverflow > 0 ? (
              <span className="text-brand text-[13px] font-bold">
                +{categoryOverflow}
              </span>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-muted text-[13px]">{t("targetCountries")}</span>
            {countries.length === 0 ? (
              <span className="text-faint text-[13px]">{tc("any")}</span>
            ) : (
              countries.map((code) => <Chip key={code}>{countryName(code)}</Chip>)
            )}
            {countryOverflow > 0 ? (
              <span className="text-brand text-[13px] font-bold">+{countryOverflow}</span>
            ) : null}
          </div>

          <p className="line-clamp-2-safe text-muted mt-3 text-[14px] leading-relaxed">
            {buyer.thesis}
          </p>

          <div className="mt-4 flex justify-end">
            <Link href={`/buyers/${buyer.id}`}>
              <Button size="sm" variant="outline">
                {t("viewMandate")}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}
