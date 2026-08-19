"use client";

import { Eye, Pencil } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import type { AssetStatus, BusinessCategory, Currency, LicenseType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/primitives";
import { Link, useRouter } from "@/i18n/navigation";
import { formatMoneyCompact } from "@/lib/money";
import { CATEGORY_LABELS, LICENSE_LABELS, countryName } from "@/lib/vocabulary";
import { setAssetStatusAction } from "@/server/actions/assets";

export type SellerListing = {
  id: string;
  ref: number;
  title: string;
  status: AssetStatus;
  category: BusinessCategory;
  country: string;
  licenseType: LicenseType;
  askingPrice: bigint;
  currency: Currency;
  viewCount: number;
  statusReason: string | null;
  publishedAt: Date | null;
};

/**
 * One row of the seller's listing table, with the status change that makes sense
 * for the state it is in.
 *
 * A listing suspended by a manager offers no controls at all and shows the
 * stated reason instead: the seller has to talk to the platform, not click their
 * way out of moderation. The server enforces the same thing — this is only the
 * honest version of it on screen.
 */
export function SellerListingRow({ asset }: { asset: SellerListing }) {
  const t = useTranslations("dashboard");
  const ta = useTranslations("assetStatus");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const suspended = asset.status === "SUSPENDED";

  function setStatus(status: AssetStatus) {
    const formData = new FormData();
    formData.set("assetId", asset.id);
    formData.set("status", status);

    startTransition(async () => {
      await setAssetStatusAction(formData);
      router.refresh();
    });
  }

  return (
    <Card className={suspended ? "border-danger/20 p-4" : "p-4"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-bold text-ink">#{asset.ref}</span>
            <Badge tone={toneFor(asset.status)}>{ta(asset.status)}</Badge>
          </div>
          <p className="mt-0.5 truncate text-[15px] text-ink">{asset.title}</p>
          <p className="mt-0.5 truncate text-[13px] text-muted">
            {CATEGORY_LABELS[asset.category]} · {LICENSE_LABELS[asset.licenseType]} ·{" "}
            {countryName(asset.country)} ·{" "}
            {formatMoneyCompact(asset.askingPrice, asset.currency, locale)} ·{" "}
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" aria-hidden />
              {asset.viewCount}
            </span>
          </p>
          {suspended && asset.statusReason ? (
            <p className="mt-2 rounded-lg bg-danger-soft px-2.5 py-1.5 text-[13px] text-danger">
              {asset.statusReason}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link href={`/assets/${asset.ref}`}>
            <Button size="sm" variant="ghost">
              {t("view")}
            </Button>
          </Link>

          {suspended ? null : (
            <>
              <Link href={`/dashboard/listings/${asset.ref}`}>
                <Button size="sm" variant="subtle">
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  {t("edit")}
                </Button>
              </Link>

              {asset.status === "PUBLISHED" ? (
                <>
                  <Button
                    size="sm"
                    variant="subtle"
                    disabled={pending}
                    onClick={() => setStatus("SOLD")}
                  >
                    {t("markSold")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => setStatus("ARCHIVED")}
                  >
                    {t("unpublish")}
                  </Button>
                </>
              ) : (
                <Button size="sm" disabled={pending} onClick={() => setStatus("PUBLISHED")}>
                  {t("publish")}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function toneFor(status: AssetStatus) {
  switch (status) {
    case "PUBLISHED":
      return "success" as const;
    case "SUSPENDED":
      return "danger" as const;
    case "SOLD":
      return "brand" as const;
    case "ARCHIVED":
      return "warning" as const;
    case "DRAFT":
    default:
      return "neutral" as const;
  }
}
