import { ArrowLeft, BadgeCheck, Building2, Eye, Info } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { ContactPanel } from "@/components/contact-panel";
import { Button } from "@/components/ui/button";
import { CountryTile } from "@/components/ui/country";
import { AttributeCell, Badge, Card, Chip } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { getCurrentUser } from "@/lib/session";
import {
  ASSET_STATUS_LABELS,
  BENEFIT_LABELS,
  BUSINESS_STATUS_LABELS,
  CATEGORY_LABELS,
  LICENSE_DESCRIPTIONS,
  LICENSE_LABELS,
  countryName,
} from "@/lib/vocabulary";
import { findAssetByRef, recordAssetView } from "@/server/queries/assets";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ref: string }>;
}): Promise<Metadata> {
  const { ref } = await params;
  return { title: `Asset #${ref}` };
}

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ locale: string; ref: string }>;
}) {
  const { locale, ref } = await params;
  setRequestLocale(locale);

  const refNumber = Number(ref);
  if (!Number.isInteger(refNumber) || refNumber <= 0) notFound();

  const viewer = await getCurrentUser();
  const lookup = await findAssetByRef(refNumber, viewer);

  if (lookup.kind === "missing") notFound();

  const [t, ta, tc] = await Promise.all([
    getTranslations("detail"),
    getTranslations("asset"),
    getTranslations("common"),
  ]);
  const currentLocale = await getLocale();

  const asset = lookup.asset;

  // The seller behind this listing was removed. The listing is not pretended
  // away — a page that says what happened beats a 404 that denies it existed,
  // and beats a 500 from rendering half a relation.
  if (lookup.kind === "gone") {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-20 text-center">
        <Info className="text-warning mx-auto h-10 w-10" aria-hidden />
        <h1 className="text-ink mt-4 text-[26px] font-bold">{t("goneTitle")}</h1>
        <p className="text-muted mt-2 text-[15px]">{t("goneBody")}</p>
        <p className="text-faint mt-1 text-[13px]">
          {ta("idLabel", { ref: asset.ref })} · {CATEGORY_LABELS[asset.category]} ·{" "}
          {countryName(asset.country)}
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/assets">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {t("backToCatalogue")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = viewer?.id === asset.sellerId;
  const isManager = viewer?.role === "MANAGER";

  // Counted once per render, and never for the seller looking at their own page —
  // otherwise the number measures editing, not interest.
  if (!isOwner && asset.status === "PUBLISHED") {
    await recordAssetView(asset.id);
  }

  const na = ta("notSpecified");
  const canContact = viewer?.role === "BUYER" && asset.status === "PUBLISHED";

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8">
      <Link
        href="/assets"
        className="text-muted hover:text-ink inline-flex items-center gap-1.5 text-[14px] font-semibold"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("backToCatalogue")}
      </Link>

      {/* A listing that is not live says so, in its own words, to whoever is
          allowed to see it at all (its owner or a manager). */}
      {asset.status !== "PUBLISHED" ? (
        <Card className="border-warning/30 bg-warning-soft mt-4 p-4">
          <p className="text-ink text-[14px] font-semibold">
            {t("notLive", { status: ASSET_STATUS_LABELS[asset.status] })}
          </p>
          {asset.statusReason ? (
            <p className="text-muted mt-1 text-[14px]">{asset.statusReason}</p>
          ) : null}
        </Card>
      ) : null}

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <CountryTile code={asset.country} className="hidden h-20 w-28 sm:grid" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-ink text-[24px] leading-tight font-bold">
                    {ta("idLabel", { ref: asset.ref })}
                  </h1>
                  {asset.seller.sellerProfile?.verified ? (
                    <span className="text-success inline-flex items-center gap-1 text-[13px] font-semibold">
                      <BadgeCheck className="h-4 w-4" aria-hidden />
                      {ta("validated")}
                    </span>
                  ) : null}
                  {isOwner || isManager ? (
                    <Badge tone="neutral">{ASSET_STATUS_LABELS[asset.status]}</Badge>
                  ) : null}
                </div>
                <p className="text-ink mt-1 text-[17px] font-semibold">{asset.title}</p>
                <p className="text-muted mt-1 flex items-center gap-1.5 text-[13px]">
                  <Eye className="h-4 w-4" aria-hidden />
                  {ta("views", { count: asset.viewCount })}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <AttributeCell label={ta("country")} value={countryName(asset.country)} />
              <AttributeCell
                label={ta("licenseType")}
                value={`${LICENSE_LABELS[asset.licenseType]} — ${LICENSE_DESCRIPTIONS[asset.licenseType]}`}
              />
              <AttributeCell
                label={ta("category")}
                value={CATEGORY_LABELS[asset.category]}
              />
              <AttributeCell
                label={ta("businessStatus")}
                value={BUSINESS_STATUS_LABELS[asset.businessStatus]}
                tone={asset.businessStatus === "ACTIVE" ? "success" : "danger"}
              />
              <AttributeCell label={ta("employees")} value={asset.employees ?? na} />
              <AttributeCell label={ta("yearOfIssue")} value={asset.yearOfIssue ?? na} />
              <AttributeCell label={ta("regulator")} value={asset.regulator ?? na} />
              <AttributeCell
                label={ta("askingPrice")}
                value={formatMoney(asset.askingPrice, asset.currency, currentLocale)}
                emphasis
                className="col-span-2 sm:col-span-1"
              />
            </div>

            {asset.benefits.length > 0 ? (
              <div className="mt-5">
                <p className="text-faint text-[13px] font-bold tracking-wide uppercase">
                  {ta("included")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {asset.benefits.map((benefit) => (
                    <Chip key={benefit}>{BENEFIT_LABELS[benefit]}</Chip>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5">
              <p className="text-faint text-[13px] font-bold tracking-wide uppercase">
                {t("description")}
              </p>
              <p className="text-body mt-2 text-[15px] leading-relaxed whitespace-pre-line">
                {asset.description}
              </p>
            </div>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <p className="text-faint text-[13px] font-bold tracking-wide uppercase">
              {t("seller")}
            </p>
            <div className="mt-2 flex items-start gap-3">
              <span className="bg-brand-soft text-brand grid h-10 w-10 shrink-0 place-items-center rounded-xl">
                <Building2 className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-ink truncate text-[15px] font-bold">
                  {asset.seller.sellerProfile?.company ?? asset.seller.name}
                </p>
                <p className="text-muted truncate text-[13px]">{asset.seller.name}</p>
                {asset.seller.sellerProfile?.country ? (
                  <p className="text-faint mt-0.5 text-[13px]">
                    {countryName(asset.seller.sellerProfile.country)}
                  </p>
                ) : null}
              </div>
            </div>
            {asset.seller.sellerProfile?.about ? (
              <p className="text-muted mt-3 text-[14px] leading-relaxed">
                {asset.seller.sellerProfile.about}
              </p>
            ) : null}

            <div className="bg-panel mt-4 rounded-xl px-3.5 py-3">
              <p className="text-muted text-[13px]">{ta("askingPrice")}</p>
              <p className="tabular text-brand text-[22px] font-bold">
                {formatMoneyCompact(asset.askingPrice, asset.currency, currentLocale)}
              </p>
            </div>
          </Card>

          {isOwner ? (
            <Card className="p-5">
              <p className="text-ink text-[14px] font-semibold">{t("yourListing")}</p>
              <p className="text-muted mt-1 text-[13px]">{t("yourListingHint")}</p>
              <Link href={`/dashboard/listings/${asset.ref}`} className="mt-3 block">
                <Button full variant="outline">
                  {t("editListing")}
                </Button>
              </Link>
            </Card>
          ) : (
            <ContactPanel
              assetRef={asset.ref}
              counterpartId={asset.sellerId}
              canContact={canContact}
              viewerRole={viewer?.role ?? null}
              locale={locale}
            />
          )}

          {isManager ? (
            <Card className="border-danger/20 p-5">
              <p className="text-ink text-[14px] font-semibold">{t("moderation")}</p>
              <p className="text-muted mt-1 text-[13px]">{t("moderationHint")}</p>
              <Link href="/moderation/assets" className="mt-3 block">
                <Button full variant="dangerOutline">
                  {t("openModeration")}
                </Button>
              </Link>
            </Card>
          ) : null}
        </aside>
      </div>

      <p className="sr-only">{tc("back")}</p>
    </div>
  );
}
