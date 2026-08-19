"use client";

import { useTranslations } from "next-intl";

import { useFilterNav } from "@/components/catalogue/filter-nav";
import { cn } from "@/lib/cn";
import { BUSINESS_CATEGORIES, CATEGORY_LABELS } from "@/lib/vocabulary";

/**
 * The category strip from the reference site: "All (143) · Bank (5) · Fintech (17)".
 *
 * The counts are computed with every other facet applied but the category facet
 * removed, so the strip keeps working as a way to move between categories rather
 * than collapsing to "the one you already picked, and zeroes".
 *
 * It writes to the same `category` parameter as the checkbox facet — the strip
 * is a shortcut into that facet, not a second, competing piece of state.
 */
export function CategoryTabs({
  total,
  byCategory,
}: {
  total: number;
  byCategory: Record<string, number>;
}) {
  const t = useTranslations("common");
  const { apply, isSelected, searchParams } = useFilterNav();

  const anySelected = (searchParams.get("category") ?? "") !== "";

  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      <Tab
        active={!anySelected}
        label={t("all")}
        count={total}
        onClick={() => apply({ category: null })}
      />

      {BUSINESS_CATEGORIES.map((category) => {
        const count = byCategory[category] ?? 0;
        return (
          <Tab
            key={category}
            active={isSelected("category", category)}
            label={CATEGORY_LABELS[category]}
            count={count}
            // Clicking a tab selects exactly that category rather than adding to
            // the selection; the checkbox facet is there for combining several.
            onClick={() => apply({ category: [category] })}
          />
        );
      })}
    </div>
  );
}

function Tab({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-[14px] font-semibold transition-colors",
        active ? "bg-ink text-white" : "text-muted hover:bg-panel hover:text-ink",
        !active && count === 0 && "opacity-45",
      )}
    >
      {label}
      <span className={cn("tabular text-[13px]", active ? "text-white/70" : "text-faint")}>
        ({count})
      </span>
    </button>
  );
}
