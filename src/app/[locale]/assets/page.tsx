import { PackageSearch } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AssetCard } from "@/components/asset-card";
import { CategoryTabs } from "@/components/catalogue/category-tabs";
import {
  FacetGroup,
  FilterPanelToggle,
  RangeFilter,
  ResetFiltersButton,
  SortSelect,
} from "@/components/catalogue/controls";
import { Pagination } from "@/components/catalogue/pagination";
import { Card, EmptyState, PageHeading } from "@/components/ui/primitives";
import { ASSET_SORTS, hasActiveAssetFilters, parseAssetFilters } from "@/lib/filters";
import { getCurrentUser } from "@/lib/session";
import {
  BUSINESS_CATEGORIES,
  BUSINESS_STATUSES,
  BUSINESS_STATUS_LABELS,
  CATEGORY_LABELS,
  COUNTRIES,
  LICENSE_DESCRIPTIONS,
  LICENSE_LABELS,
  LICENSE_TYPES,
  countryName,
} from "@/lib/vocabulary";
import { countAssetsByCategory, listPublicAssets } from "@/server/queries/assets";
import { AiSearchBar } from "@/components/catalogue/ai-search-bar";

export const metadata: Metadata = { title: "All Listings" };

export default async function AssetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // The whole page state comes from the URL. Nothing is remembered anywhere
  // else, which is what makes a refresh and a shared link behave identically.
  const filters = parseAssetFilters(await searchParams);

  const [t, tc, tf, ts, te, user] = await Promise.all([
    getTranslations("catalogue"),
    getTranslations("common"),
    getTranslations("facet"),
    getTranslations("sort"),
    getTranslations("empty"),
    getCurrentUser(),
  ]);

  const [result, facetCounts] = await Promise.all([
    listPublicAssets(filters),
    countAssetsByCategory(filters),
  ]);

  const active = hasActiveAssetFilters(filters);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      <PageHeading
        title={t("assetsTitle")}
        description={t("assetsSubtitle")}
        actions={
          <>
            <SortSelect
              label={ts("label")}
              options={ASSET_SORTS.map((value) => ({ value, label: ts(value) }))}
            />
            {active ? <ResetFiltersButton label={tc("reset")} /> : null}
          </>
        }
      />

      <div className="mt-6 space-y-4">
        <AiSearchBar placeholder={t("assetsSearch")} enabled={user !== null} />
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
              <FacetGroup
                title={tf("businessStatus")}
                paramKey="businessStatus"
                options={BUSINESS_STATUSES.map((value) => ({
                  value,
                  label: BUSINESS_STATUS_LABELS[value],
                }))}
              />
              <RangeFilter
                title={tf("price")}
                minKey="priceMin"
                maxKey="priceMax"
                hint={tf("priceHint")}
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
          <p className="text-muted mb-3 text-[14px] font-medium" aria-live="polite">
            {tc("results", { count: result.total })}
          </p>

          {result.items.length === 0 ? (
            <EmptyState
              icon={<PackageSearch className="h-8 w-8" />}
              title={te("noAssets")}
              description={te("noAssetsHint")}
              action={active ? <ResetFiltersButton label={tc("reset")} /> : null}
            />
          ) : (
            <div className="space-y-4">
              {result.items.map((asset) => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
            </div>
          )}

          <Pagination page={result.page} pageCount={result.pageCount} />
        </div>
      </div>
    </div>
  );
}
