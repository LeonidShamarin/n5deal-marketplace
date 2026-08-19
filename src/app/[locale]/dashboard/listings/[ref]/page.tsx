import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ListingForm } from "@/components/listing-form";
import { Card, PageHeading } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { toMajorUnits } from "@/lib/money";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Edit listing" };

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ locale: string; ref: string }>;
}) {
  const { locale, ref } = await params;
  setRequestLocale(locale);

  const me = await requireRole("SELLER");
  const t = await getTranslations("listingForm");

  const refNumber = Number(ref);
  if (!Number.isInteger(refNumber) || refNumber <= 0) notFound();

  const asset = await db.asset.findUnique({ where: { ref: refNumber } });
  if (!asset) notFound();

  // Someone else's listing is a real 403, not a redirect that pretends the page
  // does not exist. The server action re-checks this too.
  if (asset.sellerId !== me.id) forbidden();

  const suspended = asset.status === "SUSPENDED";

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8">
      <PageHeading title={t("editTitle")} description={t("editSubtitle")} />

      {suspended ? (
        <Card className="border-danger/20 bg-danger-soft mt-6 p-4">
          <p className="text-danger text-[14px] font-semibold">{t("suspendedTitle")}</p>
          <p className="text-muted mt-1 text-[14px]">
            {asset.statusReason ?? t("suspendedNoReason")}
          </p>
          <p className="text-muted mt-2 text-[13px]">{t("suspendedHint")}</p>
        </Card>
      ) : (
        <div className="mt-6">
          <ListingForm
            mode="edit"
            initial={{
              id: asset.id,
              ref: asset.ref,
              title: asset.title,
              description: asset.description,
              category: asset.category,
              licenseType: asset.licenseType,
              country: asset.country,
              businessStatus: asset.businessStatus,
              regulator: asset.regulator ?? "",
              // Shown in major units, which is what the seller typed in the
              // first place; the schema converts back on submit.
              askingPrice: String(toMajorUnits(asset.askingPrice)),
              currency: asset.currency,
              employees: asset.employees === null ? "" : String(asset.employees),
              yearOfIssue: asset.yearOfIssue === null ? "" : String(asset.yearOfIssue),
              benefits: asset.benefits,
              status: asset.status,
            }}
          />
        </div>
      )}
    </div>
  );
}
