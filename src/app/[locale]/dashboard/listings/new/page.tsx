import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ListingForm } from "@/components/listing-form";
import { PageHeading } from "@/components/ui/primitives";
import { requireRole } from "@/lib/session";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "New listing" };

export default async function NewListingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // SELLER only, enforced here rather than by not linking to the page.
  const me = await requireRole("SELLER");
  const t = await getTranslations("listingForm");

  // Default the jurisdiction to the seller's own country: it is right more often
  // than the first entry of an alphabetical list.
  const profile = await db.sellerProfile.findUnique({
    where: { userId: me.id },
    select: { country: true },
  });

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8">
      <PageHeading title={t("newTitle")} description={t("newSubtitle")} />
      <div className="mt-6">
        <ListingForm
          mode="create"
          initial={{
            title: "",
            description: "",
            category: "PAYMENTS",
            licenseType: "EMI",
            country: profile?.country ?? "LT",
            businessStatus: "LICENSE_ONLY",
            regulator: "",
            askingPrice: "",
            currency: "EUR",
            employees: "",
            yearOfIssue: "",
            benefits: [],
          }}
        />
      </div>
    </div>
  );
}
