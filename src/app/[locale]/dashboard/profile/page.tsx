import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { MandateForm } from "@/components/mandate-form";
import { PageHeading } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { toMajorUnits } from "@/lib/money";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "My mandate" };

export default async function BuyerProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const me = await requireRole("BUYER");
  const t = await getTranslations("mandateForm");

  const profile = await db.buyerProfile.findUnique({ where: { userId: me.id } });

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8">
      <PageHeading
        title={profile ? t("editTitle") : t("createTitle")}
        description={t("subtitle")}
      />
      <div className="mt-6">
        <MandateForm
          initial={{
            company: profile?.company ?? "",
            country: profile?.country ?? "GB",
            thesis: profile?.thesis ?? "",
            about: profile?.about ?? "",
            targetCategories: profile?.targetCategories ?? [],
            targetCountries: profile?.targetCountries ?? [],
            targetLicenseTypes: profile?.targetLicenseTypes ?? [],
            ticketMin:
              profile?.ticketMin == null ? "" : String(toMajorUnits(profile.ticketMin)),
            ticketMax:
              profile?.ticketMax == null ? "" : String(toMajorUnits(profile.ticketMax)),
            currency: profile?.currency ?? "EUR",
            needsActiveLicense: profile?.needsActiveLicense ?? false,
            visibility: profile?.visibility ?? "PUBLIC",
          }}
        />
      </div>
    </div>
  );
}
