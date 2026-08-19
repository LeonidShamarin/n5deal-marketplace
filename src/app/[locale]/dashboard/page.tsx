import { FileText, Gavel, Plus, Target, Users } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AssetCard } from "@/components/asset-card";
import { BuyerCard } from "@/components/buyer-card";
import { MatchExplanation } from "@/components/match-explanation";
import { SellerListingRow } from "@/components/seller-listing-row";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeading } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { assetsForMandate, buyersForAsset } from "@/server/queries/matching";
import { buyerViewerFor } from "@/server/queries/buyers";
import { countUnreadThreads } from "@/server/queries/threads";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * The role dashboard.
 *
 * Each role gets a different entry point, because "what do I do here" has a
 * different answer for each: a seller manages listings, a buyer maintains a
 * mandate and watches what matches it, a manager looks at the queue. One shared
 * page with everything on it would serve none of them.
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const me = await requireUser();

  if (me.role === "SELLER") return <SellerDashboard userId={me.id} name={me.name} />;
  if (me.role === "BUYER") return <BuyerDashboard userId={me.id} name={me.name} />;
  return <ManagerDashboard name={me.name} />;
}

// ---------------------------------------------------------------------------

async function SellerDashboard({ userId, name }: { userId: string; name: string }) {
  const t = await getTranslations("dashboard");

  const [assets, unread, profile] = await Promise.all([
    db.asset.findMany({
      where: { sellerId: userId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        ref: true,
        title: true,
        status: true,
        category: true,
        country: true,
        licenseType: true,
        askingPrice: true,
        currency: true,
        viewCount: true,
        statusReason: true,
        publishedAt: true,
      },
    }),
    countUnreadThreads(userId),
    db.sellerProfile.findUnique({
      where: { userId },
      select: { company: true, verified: true },
    }),
  ]);

  const counts = {
    published: assets.filter((a) => a.status === "PUBLISHED").length,
    draft: assets.filter((a) => a.status === "DRAFT").length,
    sold: assets.filter((a) => a.status === "SOLD").length,
    suspended: assets.filter((a) => a.status === "SUSPENDED").length,
  };

  // The best-matching buyers for the seller's most recently published listing —
  // a concrete "here is who to talk to next" rather than a generic list.
  const flagship = assets.find((a) => a.status === "PUBLISHED");
  const matches = flagship
    ? await buyersForAsset(flagship.id, { verifiedSeller: profile?.verified ?? false }, 3)
    : [];

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8">
      <PageHeading
        title={t("sellerTitle", { name })}
        description={profile?.company ?? undefined}
        actions={
          <Link href="/dashboard/listings/new">
            <Button>
              <Plus className="h-4 w-4" aria-hidden />
              {t("newListing")}
            </Button>
          </Link>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t("statPublished")} value={counts.published} />
        <StatTile label={t("statDrafts")} value={counts.draft} />
        <StatTile label={t("statSold")} value={counts.sold} />
        <StatTile label={t("statUnread")} value={unread} href="/inbox" />
      </div>

      {counts.suspended > 0 ? (
        <Card className="mt-4 border-danger/20 bg-danger-soft p-4">
          <p className="text-[14px] font-semibold text-danger">
            {t("suspendedNotice", { count: counts.suspended })}
          </p>
        </Card>
      ) : null}

      <section className="mt-8">
        <h2 className="text-[18px] font-bold text-ink">{t("myListings")}</h2>
        {assets.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={<FileText className="h-8 w-8" />}
              title={t("noListings")}
              description={t("noListingsHint")}
              action={
                <Link href="/dashboard/listings/new">
                  <Button>{t("newListing")}</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {assets.map((asset) => (
              <li key={asset.id}>
                <SellerListingRow asset={asset} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {matches.length > 0 && flagship ? (
        <section className="mt-8">
          <h2 className="text-[18px] font-bold text-ink">
            {t("matchingBuyers", { ref: flagship.ref })}
          </h2>
          <p className="mt-1 text-[14px] text-muted">{t("matchingBuyersHint")}</p>
          <div className="mt-3 space-y-4">
            {matches.map(({ buyer, match }) => (
              <div key={buyer.id} className="space-y-2">
                <BuyerCard buyer={buyer} matchScore={match.score} />
                <MatchExplanation match={match} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

async function BuyerDashboard({ userId, name }: { userId: string; name: string }) {
  const t = await getTranslations("dashboard");

  const [profile, unread] = await Promise.all([
    db.buyerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        company: true,
        country: true,
        thesis: true,
        targetCategories: true,
        targetCountries: true,
        targetLicenseTypes: true,
        ticketMin: true,
        ticketMax: true,
        currency: true,
        needsActiveLicense: true,
        visibility: true,
        createdAt: true,
        user: { select: { id: true, name: true, status: true } },
      },
    }),
    countUnreadThreads(userId),
  ]);

  const matches = profile ? await assetsForMandate(userId, 4) : [];

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8">
      <PageHeading
        title={t("buyerTitle", { name })}
        description={profile?.company ?? undefined}
        actions={
          <Link href="/dashboard/profile">
            <Button variant={profile ? "outline" : "primary"}>
              {profile ? t("editMandate") : t("createMandate")}
            </Button>
          </Link>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatTile label={t("statMatches")} value={matches.length} />
        <StatTile label={t("statUnread")} value={unread} href="/inbox" />
        <StatTile
          label={t("statVisibility")}
          value={profile ? t(`visibility_${profile.visibility}`) : "—"}
        />
      </div>

      {profile === null ? (
        <div className="mt-8">
          <EmptyState
            icon={<Target className="h-8 w-8" />}
            title={t("noMandate")}
            description={t("noMandateHint")}
            action={
              <Link href="/dashboard/profile">
                <Button>{t("createMandate")}</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="text-[18px] font-bold text-ink">{t("yourMandate")}</h2>
            <div className="mt-3">
              <BuyerCard buyer={profile} showVisibility />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-[18px] font-bold text-ink">{t("matchingAssets")}</h2>
            <p className="mt-1 text-[14px] text-muted">{t("matchingAssetsHint")}</p>
            {matches.length === 0 ? (
              <div className="mt-3">
                <EmptyState title={t("noMatches")} description={t("noMatchesHint")} />
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                {matches.map(({ asset, match }) => (
                  <div key={asset.id} className="space-y-2">
                    <AssetCard asset={asset} />
                    <MatchExplanation match={match} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

async function ManagerDashboard({ name }: { name: string }) {
  const t = await getTranslations("dashboard");

  const [sellers, buyers, assets, suspended, removed, suspendedAssets, events] =
    await Promise.all([
      db.user.count({ where: { role: "SELLER" } }),
      db.user.count({ where: { role: "BUYER" } }),
      db.asset.count(),
      db.user.count({ where: { status: "SUSPENDED" } }),
      db.user.count({ where: { status: "REMOVED" } }),
      db.asset.count({ where: { status: "SUSPENDED" } }),
      db.moderationEvent.count(),
    ]);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8">
      <PageHeading
        title={t("managerTitle", { name })}
        description={t("managerSubtitle")}
        actions={
          <Link href="/moderation">
            <Button>
              <Gavel className="h-4 w-4" aria-hidden />
              {t("openModeration")}
            </Button>
          </Link>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t("statSellers")} value={sellers} href="/moderation/participants" />
        <StatTile label={t("statBuyers")} value={buyers} href="/moderation/participants" />
        <StatTile label={t("statAssets")} value={assets} href="/moderation/assets" />
        <StatTile label={t("statAudit")} value={events} href="/moderation/audit" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <StatTile label={t("statSuspendedUsers")} value={suspended} tone="danger" />
        <StatTile label={t("statRemovedUsers")} value={removed} tone="danger" />
        <StatTile label={t("statSuspendedAssets")} value={suspendedAssets} tone="danger" />
      </div>

      <Card className="mt-6 p-5">
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 h-5 w-5 text-brand" aria-hidden />
          <div>
            <p className="text-[15px] font-semibold text-ink">{t("managerHowTitle")}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">
              {t("managerHowBody")}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StatTile({
  label,
  value,
  href,
  tone = "default",
}: {
  label: string;
  value: number | string;
  href?: string;
  tone?: "default" | "danger";
}) {
  const content = (
    <Card
      className={
        tone === "danger"
          ? "border-danger/20 p-4"
          : "p-4 transition-colors hover:border-line-strong"
      }
    >
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p
        className={`mt-0.5 text-[24px] font-bold ${
          tone === "danger" ? "text-danger" : "text-ink"
        }`}
      >
        {value}
      </p>
    </Card>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
