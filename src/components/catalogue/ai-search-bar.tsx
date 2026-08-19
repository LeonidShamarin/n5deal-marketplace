"use client";

import { Loader2, Search, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { useFilterNav } from "@/components/catalogue/filter-nav";
import { Input } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { parseSearchQueryAction } from "@/server/actions/search";

/**
 * The catalogue search box, with an interpret-this-sentence mode.
 *
 * Plain mode is a debounced text search. Smart mode sends the sentence to the
 * server, which turns it into structured facets and writes them into the URL —
 * so the result is an ordinary filtered catalogue page that can be shared,
 * refreshed and stepped back through. The AI does not fetch anything or render
 * anything; it only proposes URL state.
 *
 * The button is always available. Without an API key the server falls back to a
 * rule-based parser, and the badge under the box says which one answered, so
 * nobody has to guess whether the feature is on.
 */
export function AiSearchBar({
  placeholder,
  enabled,
}: {
  placeholder: string;
  /** Whether the smart-mode affordance is offered at all. */
  enabled?: boolean;
}) {
  const t = useTranslations("ai");
  const { apply, searchParams, pending } = useFilterNav();

  const urlValue = searchParams.get("q") ?? "";
  const [value, setValue] = useState(urlValue);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setValue(urlValue), [urlValue]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function schedulePlainSearch(next: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => apply({ q: next }), 350);
  }

  async function runSmartSearch() {
    const query = value.trim();
    if (query === "" || busy) return;

    if (timer.current) clearTimeout(timer.current);
    setBusy(true);
    setNote(null);

    try {
      const result = await parseSearchQueryAction({ query });
      const p = result.proposal;

      // Replace the whole filter set rather than merging into what is already
      // there: the sentence is the complete request, and leaving a stale
      // checkbox on would silently contradict what the user just typed.
      apply({
        q: p.q ?? "",
        category: p.categories ?? null,
        country: p.countries ?? null,
        license: p.licenseTypes ?? null,
        businessStatus: p.businessStatuses ?? null,
        priceMin: p.priceMinMajor ?? null,
        priceMax: p.priceMaxMajor ?? null,
      });

      setNote(
        result.weak
          ? t("noStructure")
          : result.source === "ai"
            ? t("byModel")
            : result.source === "rules-no-key"
              ? t("byRulesNoKey")
              : t("byRulesUnavailable"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="relative">
        <Search
          className="text-faint pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          value={value}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-busy={pending || busy}
          className={cn("h-12 rounded-full pl-10", enabled ? "pr-36" : "pr-4")}
          onChange={(event) => {
            setValue(event.target.value);
            setNote(null);
            schedulePlainSearch(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (timer.current) clearTimeout(timer.current);
            // Enter runs the smart path when it is offered — that is the whole
            // point of typing a sentence.
            if (enabled) void runSmartSearch();
            else apply({ q: value });
          }}
        />

        {enabled ? (
          <button
            type="button"
            onClick={() => void runSmartSearch()}
            disabled={busy || value.trim() === ""}
            className={cn(
              "absolute top-1/2 right-1.5 inline-flex h-9 -translate-y-1/2 items-center gap-1.5",
              "bg-brand rounded-full px-4 text-[14px] font-semibold text-white",
              "hover:bg-brand-hover shadow-[var(--shadow-brand)] transition-colors",
              "disabled:opacity-50",
            )}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {t("interpret")}
          </button>
        ) : null}
      </div>

      <p className="text-faint mt-1.5 min-h-[18px] px-4 text-[12px]">
        {note ?? (enabled ? t("hint") : null)}
      </p>
    </div>
  );
}
