"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { useFilterNav } from "@/components/catalogue/filter-nav";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

/**
 * Search box.
 *
 * Typing is local state so the caret does not fight the server round trip; the
 * URL is updated on a debounce, and on Enter immediately. The input is seeded
 * from the URL, which is what makes a shared link arrive with its search term
 * already in the box.
 */
export function SearchBox({
  paramKey = "q",
  placeholder,
}: {
  paramKey?: string;
  placeholder: string;
}) {
  const { apply, searchParams, pending } = useFilterNav();
  const urlValue = searchParams.get(paramKey) ?? "";
  const [value, setValue] = useState(urlValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the box in step when the URL changes from elsewhere — a reset button,
  // the back button, or a link with a different query.
  useEffect(() => {
    setValue(urlValue);
  }, [urlValue]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function schedule(next: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => apply({ [paramKey]: next }), 350);
  }

  return (
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
        aria-busy={pending}
        className="pl-10"
        onChange={(event) => {
          setValue(event.target.value);
          schedule(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (timer.current) clearTimeout(timer.current);
          apply({ [paramKey]: value });
        }}
      />
    </div>
  );
}

/**
 * A multi-select facet rendered as checkboxes.
 *
 * Checkboxes rather than a dropdown because the whole selection has to be
 * visible at a glance — a reviewer should be able to see what is filtering the
 * list without opening anything.
 */
export function FacetGroup({
  title,
  paramKey,
  options,
  counts,
  columns = 1,
}: {
  title: string;
  paramKey: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  counts?: Record<string, number>;
  columns?: 1 | 2;
}) {
  const { toggleInList, isSelected } = useFilterNav();

  return (
    <fieldset className="border-line border-t pt-4 first:border-t-0 first:pt-0">
      <legend className="text-faint mb-2 text-[13px] font-bold tracking-wide uppercase">
        {title}
      </legend>
      <div className={cn("grid gap-1.5", columns === 2 && "grid-cols-2")}>
        {options.map((option) => {
          const checked = isSelected(paramKey, option.value);
          const count = counts?.[option.value];

          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[14px] transition-colors",
                checked ? "bg-brand-soft text-ink" : "text-muted hover:bg-panel",
              )}
            >
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-[var(--color-brand)]"
                checked={checked}
                onChange={() => toggleInList(paramKey, option.value)}
              />
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {count !== undefined ? (
                <span className="tabular text-faint shrink-0 text-[12px]">{count}</span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Price / ticket range.
 *
 * Submitted on blur and on Enter rather than per keystroke: a range that fires
 * mid-typing would show "no results" for "2" on the way to "2000000" and look
 * broken.
 */
export function RangeFilter({
  title,
  minKey,
  maxKey,
  hint,
}: {
  title: string;
  minKey: string;
  maxKey: string;
  hint?: string;
}) {
  const t = useTranslations("common");
  const { apply, searchParams } = useFilterNav();

  const [min, setMin] = useState(searchParams.get(minKey) ?? "");
  const [max, setMax] = useState(searchParams.get(maxKey) ?? "");

  const urlMin = searchParams.get(minKey) ?? "";
  const urlMax = searchParams.get(maxKey) ?? "";
  useEffect(() => setMin(urlMin), [urlMin]);
  useEffect(() => setMax(urlMax), [urlMax]);

  function commit() {
    if (min === urlMin && max === urlMax) return;
    apply({ [minKey]: min.trim(), [maxKey]: max.trim() });
  }

  return (
    <fieldset className="border-line border-t pt-4">
      <legend className="text-faint mb-2 text-[13px] font-bold tracking-wide uppercase">
        {title}
      </legend>
      <div className="flex items-center gap-2">
        <Input
          inputMode="numeric"
          value={min}
          aria-label={`${title} — ${t("from")}`}
          placeholder={t("from")}
          className="h-10"
          onChange={(event) => setMin(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => event.key === "Enter" && commit()}
        />
        <span className="text-faint">–</span>
        <Input
          inputMode="numeric"
          value={max}
          aria-label={`${title} — ${t("to")}`}
          placeholder={t("to")}
          className="h-10"
          onChange={(event) => setMax(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => event.key === "Enter" && commit()}
        />
      </div>
      {hint ? <p className="text-faint mt-1.5 text-[12px]">{hint}</p> : null}
    </fieldset>
  );
}

/** Single-choice facet for a tri-state boolean (any / yes / no). */
export function TriStateFilter({
  title,
  paramKey,
  yesLabel,
  noLabel,
}: {
  title: string;
  paramKey: string;
  yesLabel: string;
  noLabel: string;
}) {
  const t = useTranslations("common");
  const { apply, searchParams } = useFilterNav();
  const current = searchParams.get(paramKey) ?? "";

  const options = [
    { value: "", label: t("any") },
    { value: "1", label: yesLabel },
    { value: "0", label: noLabel },
  ];

  return (
    <fieldset className="border-line border-t pt-4">
      <legend className="text-faint mb-2 text-[13px] font-bold tracking-wide uppercase">
        {title}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value || "any"}
            type="button"
            onClick={() => apply({ [paramKey]: option.value })}
            aria-pressed={current === option.value}
            className={cn(
              "rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors",
              current === option.value
                ? "bg-ink text-white"
                : "bg-panel text-muted hover:text-ink",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SortSelect({
  options,
  label,
}: {
  options: ReadonlyArray<{ value: string; label: string }>;
  label: string;
}) {
  const { apply, searchParams } = useFilterNav();

  return (
    <Select
      aria-label={label}
      className="h-10 w-auto min-w-[170px]"
      value={searchParams.get("sort") ?? options[0]?.value}
      onChange={(event) => apply({ sort: event.target.value })}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

export function ResetFiltersButton({ label }: { label: string }) {
  const { reset } = useFilterNav();
  return (
    <Button type="button" variant="ghost" size="sm" onClick={reset}>
      <X className="h-4 w-4" aria-hidden />
      {label}
    </Button>
  );
}

/**
 * On a narrow screen the facet column would push the results below the fold, so
 * it collapses behind a toggle. It stays in the DOM either way — hiding it with
 * CSS keeps the checkboxes addressable and the URL the single source of truth.
 */
export function FilterPanelToggle({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="subtle"
        size="sm"
        className="lg:hidden"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        {label}
      </Button>
      <div className={cn("lg:block", open ? "block" : "hidden")}>{children}</div>
    </>
  );
}
