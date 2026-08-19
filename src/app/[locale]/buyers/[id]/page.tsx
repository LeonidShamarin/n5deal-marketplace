import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { ContactPanel } from "@/components/contact-panel";
import { Button } from "@/components/ui/button";
import { CountryTile } from "@/components/ui/country";
import { AttributeCell, Badge, Card, Chip } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { formatRange } from "@/lib/money";
import { getCurrentUser } from "@/lib/session";
import {
  CATEGORY_LABELS,
  LICENSE_DESCRIPTIONS,
  LICENSE_LABELS,
  VISIBILITY_LABELS,
  countryName,
} from "@/lib/vocabulary";
import { buyerViewerFor, findBuyerProfile } from "@/server/queries/buyers";

export const metadata: Metadata = { title: "Buyer mandate" };

export default async function BuyerDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  const viewer = await buyerViewerFor(user);

  // The visibility rules live inside the query, so a hidden mandate comes back
  // as "not found" for anyone not entitled to it — including someone who typed
  // the id by hand.
  const buyer = await findBuyerProfile(id, viewer);
  if (!buyer) notFound();

  const [t, tc, td] = await Promise.all([
    getTranslations("buyer"),
    getTranslations("common"),
    getTranslations("detail"),
  ]);
  const currentLocale = await getLocale();

  const isOwner = user?.id === buyer.user.id;
  const canContact =
    user?.role === "SELLER" && !isOwner && buyer.user.status === "ACTIVE";

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8">
      <Link
        href="/buyers"
        className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("backToBuyers")}
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <CountryTile code={buyer.country} className="hidden h-20 w-28 sm:grid" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[24px] font-bold leading-tight text-ink">
                  {buyer.company}
                </h1>
                {isOwner || user?.role === "MANAGER" ? (
                  <Badge tone={buyer.visibility === "HIDDEN" ? "danger" : "neutral"}>
                    {VISIBILITY_LABELS[buyer.visibility]}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-[15px] text-muted">
                {buyer.user.name} · {countryName(buyer.country)}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[13px] font-bold uppercase tracking-wide text-faint">
              {t("mandate")}
            </p>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-body">
              {buyer.thesis}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <AttributeCell
              label={t("ticketSize")}
              value={formatRange(
                buyer.ticketMin,
                buyer.ticketMax,
                buyer.currency,
                currentLocale,
              )}
              emphasis
            />
            <AttributeCell
              label={t("needsActiveLicense")}
              value={buyer.needsActiveLicense ? tc("yes") : tc("no")}
              tone={buyer.needsActiveLicense ? "success" : "muted"}
            />
            <AttributeCell
              label={t("targetLicenses")}
              value={
                buyer.targetLicenseTypes.length > 0
                  ? buyer.targetLicenseTypes.map((l) => LICENSE_LABELS[l]).join(", ")
                  : tc("any")
              }
            />
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <p className="text-[13px] font-bold uppercase tracking-wide text-faint">
                {t("targetCategories")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {buyer.targetCategories.length === 0 ? (
                  <span className="text-[14px] text-faint">{tc("any")}</span>
                ) : (
                  buyer.targetCategories.map((category) => (
                    <Chip key={category}>{CATEGORY_LABELS[category]}</Chip>
                  ))
                )}
              </div>
            </div>

            <div>
              <p className="text-[13px] font-bold uppercase tracking-wide text-faint">
                {t("targetCountries")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {buyer.targetCountries.length === 0 ? (
                  <span className="text-[14px] text-faint">{tc("any")}</span>
                ) : (
                  buyer.targetCountries.map((code) => (
                    <Chip key={code}>{countryName(code)}</Chip>
                  ))
                )}
              </div>
            </div>

            {buyer.targetLicenseTypes.length > 0 ? (
              <div>
                <p className="text-[13px] font-bold uppercase tracking-wide text-faint">
                  {t("targetLicenses")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {buyer.targetLicenseTypes.map((licence) => (
                    <Chip key={licence}>
                      {LICENSE_LABELS[licence]} — {LICENSE_DESCRIPTIONS[licence]}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {buyer.about ? (
            <div className="mt-5">
              <p className="text-[13px] font-bold uppercase tracking-wide text-faint">
                {td("description")}
              </p>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-body">
                {buyer.about}
              </p>
            </div>
          ) : null}
        </Card>

        <aside className="space-y-4">
          {isOwner ? (
            <Card className="p-5">
              <p className="text-[14px] font-semibold text-ink">{t("yourMandate")}</p>
              <p className="mt-1 text-[13px] text-muted">{t("yourMandateHint")}</p>
              <Link href="/dashboard/profile" className="mt-3 block">
                <Button full variant="outline">
                  {t("editMandate")}
                </Button>
              </Link>
            </Card>
          ) : (
            <ContactPanel
              counterpartId={buyer.user.id}
              canContact={canContact}
              viewerRole={user?.role ?? null}
              locale={locale}
              variant="buyer"
            />
          )}
        </aside>
      </div>
    </div>
  );
}
