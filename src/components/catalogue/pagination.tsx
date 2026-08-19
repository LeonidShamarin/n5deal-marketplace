"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { useFilterNav } from "@/components/catalogue/filter-nav";
import { Button } from "@/components/ui/button";

/**
 * Paging is the one filter change that gets a real history entry and scrolls
 * back to the top — a reader who pressed "next" expects the back button to
 * return them to the previous page of results, not to their last checkbox.
 */
export function Pagination({ page, pageCount }: { page: number; pageCount: number }) {
  const t = useTranslations("common");
  const { apply, pending } = useFilterNav();

  if (pageCount <= 1) return null;

  return (
    <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Pagination">
      <Button
        type="button"
        variant="subtle"
        size="sm"
        disabled={page <= 1 || pending}
        onClick={() => apply({ page: page - 1 }, { push: true })}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        {t("previous")}
      </Button>

      <span className="tabular text-muted text-[14px]" aria-live="polite">
        {t("page", { page, total: pageCount })}
      </span>

      <Button
        type="button"
        variant="subtle"
        size="sm"
        disabled={page >= pageCount || pending}
        onClick={() => apply({ page: page + 1 }, { push: true })}
      >
        {t("next")}
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Button>
    </nav>
  );
}
