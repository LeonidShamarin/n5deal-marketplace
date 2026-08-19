"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { buildQuery, type QueryValue } from "@/lib/filters";

/**
 * The one place a filter control is allowed to change catalogue state.
 *
 * Controls never hold their selection in React state — they read it from the URL
 * and write it back through here. The server then re-renders from the new URL,
 * which is why a refresh, a shared link and the back button all agree with each
 * other without any extra work.
 *
 * `router.replace` with `scroll: false` keeps ticking a checkbox from pushing a
 * history entry per click and from yanking the page back to the top; only a
 * page change deserves a real navigation.
 */
export function useFilterNav() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const apply = useCallback(
    (patch: Record<string, QueryValue>, options?: { push?: boolean }) => {
      const query = buildQuery(new URLSearchParams(searchParams.toString()), patch);
      const href = `${pathname}${query}`;

      startTransition(() => {
        if (options?.push) router.push(href, { scroll: true });
        else router.replace(href, { scroll: false });
      });
    },
    [searchParams, pathname, router],
  );

  /** Add or remove one value from a comma-separated multi-value facet. */
  const toggleInList = useCallback(
    (key: string, value: string) => {
      const current = (searchParams.get(key) ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item !== "");

      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];

      apply({ [key]: next });
    },
    [searchParams, apply],
  );

  const isSelected = useCallback(
    (key: string, value: string) =>
      (searchParams.get(key) ?? "").split(",").includes(value),
    [searchParams],
  );

  const reset = useCallback(() => {
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }, [pathname, router]);

  return { apply, toggleInList, isSelected, reset, pending, searchParams };
}
