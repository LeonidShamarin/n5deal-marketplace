"use client";

import { Check, Loader2, Minus, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { matchBand, type MatchResult } from "@/lib/matching";
import { explainMatchAction } from "@/server/actions/match-explanation";

/**
 * Why a buyer and a listing fit — or do not.
 *
 * The score and the reasons are already computed, deterministically, before this
 * component renders: it never waits on a model to show something useful. The
 * "explain" button is an optional extra that turns those same factors into a
 * sentence, and it is opt-in per match rather than automatic, so opening a
 * dashboard with four matches does not fire four model calls.
 */
export function MatchExplanation({ match }: { match: MatchResult }) {
  const t = useTranslations("match");
  const [prose, setProse] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const band = matchBand(match.score);

  const bandClass = {
    strong: "border-success/20 bg-success-soft",
    possible: "border-brand-border bg-brand-soft",
    weak: "border-line bg-panel",
  }[band];

  function explain() {
    setFailed(false);
    startTransition(async () => {
      const result = await explainMatchAction({
        score: match.score,
        factors: match.factors.map((f) => ({ hit: f.hit, detail: f.detail })),
      });
      if (result === null) setFailed(true);
      else setProse(result);
    });
  }

  return (
    <div className={cn("rounded-xl border px-4 py-3", bandClass)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-bold uppercase tracking-wide text-muted">
          {t("whyLabel", { score: match.score })}
        </p>
        {prose === null ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={explain}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            )}
            {t("explain")}
          </Button>
        ) : null}
      </div>

      <ul className="mt-2 space-y-1">
        {match.strengths.slice(0, 3).map((factor) => (
          <li key={factor.key} className="flex items-start gap-2 text-[13px] text-body">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
            {factor.detail}
          </li>
        ))}
        {match.gaps.slice(0, 2).map((factor) => (
          <li key={factor.key} className="flex items-start gap-2 text-[13px] text-muted">
            <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
            {factor.detail}
          </li>
        ))}
      </ul>

      {prose ? (
        <p className="mt-3 border-t border-line pt-3 text-[14px] leading-relaxed text-body">
          {prose}
        </p>
      ) : null}

      {failed ? (
        <p className="mt-2 text-[12px] text-faint">{t("explainUnavailable")}</p>
      ) : null}
    </div>
  );
}
