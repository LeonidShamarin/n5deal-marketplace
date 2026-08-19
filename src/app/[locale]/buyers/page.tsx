import { Users } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { BuyerCard } from "@/components/buyer-card";
import { CategoryTabs } from "@/components/catalogue/category-tabs";
import {
  FacetGroup,
  FilterPanelToggle,
  RangeFilter,
  ResetFiltersButton,
  SearchBox,
  SortSelect,
  TriStateFilter,
} from "@/components/catalogue/controls";
import { Pagination } from "@/components/catalogue/pagination";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeading } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { BUYER_SORTS, hasActiveBuyerFilters, parseBuyerFilters } from "@/lib/filters";
import { getCurrentUser } from "@/lib/session";
import {
  BUSINESS_CATEGORIES,
  CATEGORY_LABELS,
  COUNTRIES,
  LICENSE_DESCRIPTIONS,
  LICENSE_LABELS,
  LICENSE_TYPES,
  countryName,
} from "@/lib/vocabulary";
import { buyerViewerFor, countBuyersByCategory, listBuyers } from "@/server/queries/buyers";

export const metadata: Metadata = { title: "Buyer mandates" };

export default async function BuyersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const filters = parseBuyerFilters(await searchParams);

  const [t, tc, tf, ts, te, tb, user] = await Promise.all([
    getTranslations("catalogue"),
    getTranslations("common"),
    getTranslations("facet"),
    getTranslations("sort"),
    getTranslations("empty"),
    getTranslations("buyer"),
    getCurrentUser(),
  ]);

  const viewer = await buyerViewerFor(user);

  // Signed-out visitors get an explanation rather than an empty list: a
  // directory of who is buying what, with budgets, is not public information.
  if (!viewer) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-20 text-center">
        <Users className="mx-auto h-10 w-10 text-faint" aria-hidden />
        <h1 className="mt-4 text-[26px] font-bold text-ink">{tb("signedOutTitle")}</h1>
        <p className="mt-2 text-[15px] text-muted">{tb("signedOutBody")}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/sign-in">
            <Button>{tb("signIn")}</Button>
          </Link>
          <Link href="/assets">
            <Button variant="outline">{tb("browseAssets")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const [result, facetCounts] = await Promise.all([
    listBuyers(filters, viewer),
    countBuyersByCategory(filters, viewer),
  ]);

  const active = hasActiveBuyerFilters(filters);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      <PageHeading
        title={t("buyersTitle")}
        description={t("buyersSubtitle")}
        actions={
          <>
            <SortSelect
              label={ts("label")}
              options={BUYER_SORTS.map((value) => ({ value, label: ts(value) }))}
            />
            {active ? <ResetFiltersButton label={tc("reset")} /> : null}
          </>
        }
      />

      <div className="mt-6 space-y-4">
        <SearchBox placeholder={t("buyersSearch")} />
        <CategoryTabs total={facetCounts.total} byCategory={facetCounts.byCategory} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="space-y-3">
          <FilterPanelToggle label={t("showFilters")}>
            <Card className="space-y-4 p-4">
              <FacetGroup
                title={tf("category")}
                paramKey="category"
                counts={facetCounts.byCategory}
                options={BUSINESS_CATEGORIES.map((value) => ({
                  value,
                  label: CATEGORY_LABELS[value],
                }))}
              />
              <FacetGroup
                title={tf("license")}
                paramKey="license"
                options={LICENSE_TYPES.map((value) => ({
                  value,
                  label: `${LICENSE_LABELS[value]} — ${LICENSE_DESCRIPTIONS[value]}`,
                }))}
              />
              <RangeFilter
                title={tf("ticket")}
                minKey="ticketMin"
                maxKey="ticketMax"
                hint={tf("ticketHint")}
              />
              <TriStateFilter
                title={tf("needsActive")}
                paramKey="needsActive"
                yesLabel={tf("needsActiveYes")}
                noLabel={tf("needsActiveNo")}
              />
              <FacetGroup
                title={tf("country")}
                paramKey="country"
                options={COUNTRIES.map((country) => ({
                  value: country.code,
                  label: `${country.code} · ${countryName(country.code)}`,
                }))}
              />
            </Card>
          </FilterPanelToggle>
        </div>

        <div>
          <p className="mb-3 text-[14px] font-medium text-muted" aria-live="polite">
            {tc("results", { count: result.total })}
          </p>

          {result.items.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title={te("noBuyers")}
              description={te("noBuyersHint")}
              action={active ? <ResetFiltersButton label={tc("reset")} /> : null}
            />
          ) : (
            <div className="space-y-4">
              {result.items.map((buyer) => (
                <BuyerCard
                  key={buyer.id}
                  buyer={buyer}
                  showVisibility={user?.role === "MANAGER" || user?.role === "BUYER"}
                />
              ))}
            </div>
          )}

          <Pagination page={result.page} pageCount={result.pageCount} />
        </div>
      </div>
    </div>
  );
}
