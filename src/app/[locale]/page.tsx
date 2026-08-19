import { ArrowRight, Building2, Gavel, Search } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";
import { getCurrentUser } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/vocabulary";
import { signInAsDemoAction } from "@/server/actions/auth";

const ROLE_ICONS = {
  seller: Building2,
  buyer: Search,
  manager: Gavel,
} as const;

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("landing");
  const user = await getCurrentUser();

  // Counting only what a visitor could actually reach keeps the headline numbers
  // honest: published listings whose seller is active, and visible mandates.
  const [assetCount, buyerCount, sellerCount] = await Promise.all([
    db.asset.count({
      where: { status: "PUBLISHED", seller: { status: "ACTIVE" } },
    }),
    db.buyerProfile.count({
      where: { visibility: { not: "HIDDEN" }, user: { status: "ACTIVE" } },
    }),
    db.user.count({ where: { role: "SELLER", status: "ACTIVE" } }),
  ]);

  const stats = [
    { value: assetCount, label: t("statsAssets") },
    { value: buyerCount, label: t("statsBuyers") },
    { value: sellerCount, label: t("statsSellers") },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-4">
      <section className="py-14 sm:py-20">
        <Badge tone="brand" size="md">
          {t("eyebrow")}
        </Badge>
        <h1 className="mt-4 max-w-3xl text-[34px] font-bold leading-[1.15] text-ink sm:text-[46px]">
          {t("title")}
        </h1>
        <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-muted">
          {t("subtitle")}
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/assets">
            <Button size="lg">
              {t("browseAssets")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </Link>
          <Link href="/buyers">
            <Button size="lg" variant="outline">
              {t("browseBuyers")}
            </Button>
          </Link>
        </div>

        <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-[13px] font-medium text-muted">{stat.label}</dt>
              <dd className="text-[28px] font-bold tabular text-ink">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* One click into each role. A reviewer should never have to type a
          password to see what a seller sees. */}
      <section className="mb-16">
        <h2 className="text-[22px] font-bold text-ink">{t("demoTitle")}</h2>
        <p className="mt-1 max-w-2xl text-[15px] text-muted">{t("demoSubtitle")}</p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {DEMO_ACCOUNTS.map((account) => {
            const Icon = ROLE_ICONS[account.key as keyof typeof ROLE_ICONS];
            const blurbKey = {
              seller: "roleSellerBlurb",
              buyer: "roleBuyerBlurb",
              manager: "roleManagerBlurb",
            }[account.key] as "roleSellerBlurb" | "roleBuyerBlurb" | "roleManagerBlurb";

            return (
              <Card key={account.key} className="flex flex-col p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-bold text-ink">
                      {ROLE_LABELS[account.role]}
                    </p>
                    <p className="truncate text-[13px] text-faint">{account.email}</p>
                  </div>
                </div>

                <p className="mt-3 flex-1 text-[14px] leading-relaxed text-muted">
                  {t(blurbKey)}
                </p>

                <form action={signInAsDemoAction} className="mt-4">
                  <input type="hidden" name="role" value={account.key} />
                  <input type="hidden" name="locale" value={locale} />
                  <Button type="submit" full variant="outline">
                    {t("continueAs", { role: ROLE_LABELS[account.role] })}
                  </Button>
                </form>
              </Card>
            );
          })}
        </div>

        <p className="mt-4 text-[13px] text-faint">
          {t("demoHint", { password: DEMO_PASSWORD })}
          {user ? ` — ${user.name}` : null}
        </p>
      </section>
    </div>
  );
}
