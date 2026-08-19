"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { useRouter } from "@/i18n/navigation";
import { assetInputFromFormData } from "@/lib/asset-schema";
import { cn } from "@/lib/cn";
import type { ReviewIssue, ReviewSeverity } from "@/lib/listing-review";
import {
  ASSET_BENEFITS,
  BENEFIT_LABELS,
  BUSINESS_CATEGORIES,
  BUSINESS_STATUSES,
  BUSINESS_STATUS_LABELS,
  CATEGORY_LABELS,
  COUNTRIES,
  CURRENCIES,
  LICENSE_DESCRIPTIONS,
  LICENSE_TYPES,
  REGULATORS_BY_COUNTRY,
  countryName,
} from "@/lib/vocabulary";
import { createAssetAction, updateAssetAction } from "@/server/actions/assets";
import {
  reviewListingAction,
  type ListingReviewResult,
} from "@/server/actions/listing-review";

export type ListingFormValues = {
  id?: string;
  ref?: number;
  title: string;
  description: string;
  category: string;
  licenseType: string;
  country: string;
  businessStatus: string;
  regulator: string;
  askingPrice: string;
  currency: string;
  employees: string;
  yearOfIssue: string;
  benefits: string[];
  status?: string;
};

const SEVERITY_STYLE: Record<ReviewSeverity, { icon: typeof Info; className: string }> = {
  error: { icon: XCircle, className: "border-danger/20 bg-danger-soft text-danger" },
  warning: {
    icon: AlertTriangle,
    className: "border-warning/20 bg-warning-soft text-warning",
  },
  hint: { icon: Info, className: "border-line bg-panel text-muted" },
};

/**
 * The listing form.
 *
 * "Review draft" is separate from "Publish" on purpose. The review costs a model
 * call and, more importantly, it is advice — mixing it into the submit button
 * would make publishing feel like asking permission from an AI. The rule-based
 * errors do block publishing; nothing the model says ever does.
 */
export function ListingForm({
  initial,
  mode,
}: {
  initial: ListingFormValues;
  mode: "create" | "edit";
}) {
  const t = useTranslations("listingForm");
  const tc = useTranslations("common");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const action = mode === "create" ? createAssetAction : updateAssetAction;
  const [state, formAction] = useActionState(action, null);

  const [country, setCountry] = useState(initial.country);
  const [review, setReview] = useState<ListingReviewResult | null>(null);
  const [reviewing, startReview] = useTransition();

  useEffect(() => {
    if (state?.ok) {
      router.push(`/assets/${state.data.ref}`);
      router.refresh();
    }
  }, [state, router]);

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const formError =
    state && !state.ok && state.fieldErrors === undefined ? state.message : null;

  function runReview() {
    const form = formRef.current;
    if (!form) return;

    // The draft is read straight out of the live form, so "review" always looks
    // at what is on screen rather than at what was last saved.
    const input = assetInputFromFormData(new FormData(form));

    startReview(async () => {
      setReview(await reviewListingAction(input));
    });
  }

  const regulatorSuggestions = REGULATORS_BY_COUNTRY[country] ?? [];

  return (
    <form ref={formRef} action={formAction} className="space-y-5" noValidate>
      {initial.id ? <input type="hidden" name="assetId" value={initial.id} /> : null}

      <Card className="space-y-4 p-5">
        <Field id="title" label={t("title")} error={fieldErrors.title} required>
          <Input
            id="title"
            name="title"
            defaultValue={initial.title}
            maxLength={140}
            placeholder={t("titlePlaceholder")}
            aria-invalid={fieldErrors.title ? true : undefined}
          />
        </Field>

        <Field
          id="description"
          label={t("description")}
          hint={t("descriptionHint")}
          error={fieldErrors.description}
          required
        >
          <Textarea
            id="description"
            name="description"
            defaultValue={initial.description}
            maxLength={4000}
            className="min-h-40"
            placeholder={t("descriptionPlaceholder")}
            aria-invalid={fieldErrors.description ? true : undefined}
          />
        </Field>
      </Card>

      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <Field id="category" label={t("category")} error={fieldErrors.category} required>
          <Select id="category" name="category" defaultValue={initial.category}>
            {BUSINESS_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="licenseType"
          label={t("licenseType")}
          error={fieldErrors.licenseType}
          required
        >
          <Select id="licenseType" name="licenseType" defaultValue={initial.licenseType}>
            {LICENSE_TYPES.map((value) => (
              <option key={value} value={value}>
                {LICENSE_DESCRIPTIONS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field id="country" label={t("country")} error={fieldErrors.country} required>
          <Select
            id="country"
            name="country"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
          >
            {COUNTRIES.map((item) => (
              <option key={item.code} value={item.code}>
                {countryName(item.code)}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="regulator"
          label={t("regulator")}
          hint={
            regulatorSuggestions.length > 0
              ? t("regulatorHint", { list: regulatorSuggestions.join(", ") })
              : undefined
          }
          error={fieldErrors.regulator}
        >
          <Input
            id="regulator"
            name="regulator"
            defaultValue={initial.regulator}
            list="regulator-options"
            maxLength={80}
            placeholder={regulatorSuggestions[0] ?? ""}
          />
          <datalist id="regulator-options">
            {regulatorSuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </Field>

        <Field
          id="businessStatus"
          label={t("businessStatus")}
          error={fieldErrors.businessStatus}
          required
        >
          <Select
            id="businessStatus"
            name="businessStatus"
            defaultValue={initial.businessStatus}
          >
            {BUSINESS_STATUSES.map((value) => (
              <option key={value} value={value}>
                {BUSINESS_STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field id="employees" label={t("employees")} error={fieldErrors.employees}>
          <Input
            id="employees"
            name="employees"
            inputMode="numeric"
            defaultValue={initial.employees}
            placeholder="12"
          />
        </Field>

        <Field
          id="askingPrice"
          label={t("askingPrice")}
          hint={t("askingPriceHint")}
          error={fieldErrors.askingPrice}
          required
        >
          <Input
            id="askingPrice"
            name="askingPrice"
            defaultValue={initial.askingPrice}
            placeholder="2 500 000"
            aria-invalid={fieldErrors.askingPrice ? true : undefined}
          />
        </Field>

        <Field id="currency" label={t("currency")} error={fieldErrors.currency}>
          <Select id="currency" name="currency" defaultValue={initial.currency}>
            {CURRENCIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>

        <Field id="yearOfIssue" label={t("yearOfIssue")} error={fieldErrors.yearOfIssue}>
          <Input
            id="yearOfIssue"
            name="yearOfIssue"
            inputMode="numeric"
            defaultValue={initial.yearOfIssue}
            placeholder="2019"
          />
        </Field>
      </Card>

      <Card className="p-5">
        <p className="text-ink text-[14px] font-semibold">{t("benefits")}</p>
        <p className="text-muted mt-1 text-[13px]">{t("benefitsHint")}</p>
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {ASSET_BENEFITS.map((benefit) => (
            <label
              key={benefit}
              className="text-muted hover:bg-panel flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[14px]"
            >
              <input
                type="checkbox"
                name="benefits"
                value={benefit}
                defaultChecked={initial.benefits.includes(benefit)}
                className="h-4 w-4 accent-[var(--color-brand)]"
              />
              {BENEFIT_LABELS[benefit]}
            </label>
          ))}
        </div>
      </Card>

      {/* --- Draft review ---------------------------------------------- */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-ink text-[14px] font-semibold">{t("reviewTitle")}</p>
            <p className="text-muted mt-1 text-[13px]">{t("reviewHint")}</p>
          </div>
          <Button type="button" variant="subtle" onClick={runReview} disabled={reviewing}>
            {reviewing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {reviewing ? tc("loading") : t("reviewButton")}
          </Button>
        </div>

        {review ? (
          <div className="mt-4 space-y-2">
            {review.issues.length === 0 ? (
              <p className="border-success/20 bg-success-soft text-success flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[14px] font-medium">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                {t("reviewClean")}
              </p>
            ) : (
              review.issues.map((issue, index) => (
                <ReviewRow key={`${issue.severity}-${index}`} issue={issue} />
              ))
            )}
            <p className="text-faint pt-1 text-[12px]">
              {review.aiUsed ? t("reviewByAi") : t("reviewByRules")}
            </p>
          </div>
        ) : null}
      </Card>

      {formError ? (
        <p
          role="alert"
          className="border-danger/20 bg-danger-soft text-danger rounded-xl border px-3.5 py-2.5 text-[14px] font-medium"
        >
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="intent" value="publish">
          {t("publish")}
        </Button>
        <Button type="submit" name="intent" value="draft" variant="subtle">
          {t("saveDraft")}
        </Button>
      </div>
    </form>
  );
}

function ReviewRow({ issue }: { issue: ReviewIssue }) {
  const { icon: Icon, className } = SEVERITY_STYLE[issue.severity];
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[14px]",
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{issue.message}</span>
    </p>
  );
}
