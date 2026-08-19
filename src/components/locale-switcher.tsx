"use client";

import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/cn";

const LABELS: Record<string, string> = { en: "EN", uk: "УКР" };

/**
 * Switching language replaces the locale segment and keeps everything else about
 * the URL — including the current filters, page number and search text. That is
 * only possible because the catalogue state lives in the URL rather than in
 * component state, and it is the reason the switch survives a refresh.
 */
export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // `usePathname` is locale-stripped but also query-stripped, so the filters have
  // to be re-attached by hand — otherwise switching language would silently reset
  // the catalogue, which is the opposite of what URL-held state is for.
  const query = searchParams.toString();
  const target = query === "" ? pathname : `${pathname}?${query}`;

  return (
    <div
      className="border-line bg-panel flex items-center rounded-full border p-0.5"
      role="group"
    >
      {routing.locales.map((code) => (
        <button
          key={code}
          type="button"
          disabled={pending}
          aria-pressed={code === locale}
          onClick={() => {
            if (code === locale) return;
            startTransition(() => {
              router.replace(target, { locale: code, scroll: false });
            });
          }}
          className={cn(
            "rounded-full px-2.5 py-1 text-[12px] font-bold transition-colors disabled:opacity-60",
            code === locale
              ? "text-ink bg-white shadow-[var(--shadow-card)]"
              : "text-muted hover:text-ink",
          )}
        >
          {LABELS[code] ?? code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
