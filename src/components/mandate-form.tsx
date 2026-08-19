"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Card, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { useRouter } from "@/i18n/navigation";
import {
  BUSINESS_CATEGORIES,
  CATEGORY_LABELS,
  COUNTRIES,
  CURRENCIES,
  LICENSE_DESCRIPTIONS,
  LICENSE_TYPES,
  VISIBILITY_LABELS,
  countryName,
} from "@/lib/vocabulary";
import { saveBuyerProfileAction } from "@/server/actions/buyer-profile";

export type MandateFormValues = {
  company: string;
  country: string;
  thesis: string;
  about: string;
  targetCategories: string[];
  targetCountries: string[];
  targetLicenseTypes: string[];
  ticketMin: string;
  ticketMax: string;
  currency: string;
  needsActiveLicense: boolean;
  visibility: string;
};

function SaveButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * The acquisition mandate form.
 *
 * The fields are deliberately the same vocabulary a seller fills in on a
 * listing — category, jurisdiction, licence type, ticket size. That symmetry is
 * what makes matching possible at all, and it also means a buyer who has
 * browsed the catalogue already knows what these words mean.
 */
export function MandateForm({ initial }: { initial: MandateFormValues }) {
  const t = useTranslations("mandateForm");
  const tb = useTranslations("buyer");
  const tc = useTranslations("common");
  const router = useRouter();

  const [state, formAction] = useActionState(saveBuyerProfileAction, null);

  useEffect(() => {
    if (state?.ok) {
      router.push("/dashboard");
      router.refresh();
    }
  }, [state, router]);

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const formError =
    state && !state.ok && state.fieldErrors === undefined ? state.message : null;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <Field id="company" label={t("company")} error={fieldErrors.company} required>
          <Input
            id="company"
            name="company"
            defaultValue={initial.company}
            maxLength={120}
            aria-invalid={fieldErrors.company ? true : undefined}
          />
        </Field>

        <Field id="country" label={t("country")} error={fieldErrors.country} required>
          <Select id="country" name="country" defaultValue={initial.country}>
            {COUNTRIES.map((item) => (
              <option key={item.code} value={item.code}>
                {countryName(item.code)}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="thesis"
          label={t("thesis")}
          hint={t("thesisHint")}
          error={fieldErrors.thesis}
          required
          className="sm:col-span-2"
        >
          <Textarea
            id="thesis"
            name="thesis"
            defaultValue={initial.thesis}
            maxLength={2000}
            className="min-h-32"
            placeholder={t("thesisPlaceholder")}
            aria-invalid={fieldErrors.thesis ? true : undefined}
          />
        </Field>
      </Card>

      <Card className="space-y-4 p-5">
        <p className="text-ink text-[14px] font-semibold">{t("targets")}</p>

        <fieldset>
          <legend className="text-faint mb-2 text-[13px] font-bold tracking-wide uppercase">
            {tb("targetCategories")}
          </legend>
          <div className="grid gap-1.5 sm:grid-cols-3">
            {BUSINESS_CATEGORIES.map((value) => (
              <label
                key={value}
                className="text-muted hover:bg-panel flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[14px]"
              >
                <input
                  type="checkbox"
                  name="targetCategories"
                  value={value}
                  defaultChecked={initial.targetCategories.includes(value)}
                  className="h-4 w-4 accent-[var(--color-brand)]"
                />
                {CATEGORY_LABELS[value]}
              </label>
            ))}
          </div>
          <p className="text-faint mt-1 text-[12px]">{t("emptyMeansAny")}</p>
        </fieldset>

        <fieldset className="border-line border-t pt-4">
          <legend className="text-faint mb-2 text-[13px] font-bold tracking-wide uppercase">
            {tb("targetLicenses")}
          </legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {LICENSE_TYPES.map((value) => (
              <label
                key={value}
                className="text-muted hover:bg-panel flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[14px]"
              >
                <input
                  type="checkbox"
                  name="targetLicenseTypes"
                  value={value}
                  defaultChecked={initial.targetLicenseTypes.includes(value)}
                  className="h-4 w-4 accent-[var(--color-brand)]"
                />
                {LICENSE_DESCRIPTIONS[value]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="border-line border-t pt-4">
          <legend className="text-faint mb-2 text-[13px] font-bold tracking-wide uppercase">
            {tb("targetCountries")}
          </legend>
          <div className="grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-3">
            {COUNTRIES.map((item) => (
              <label
                key={item.code}
                className="text-muted hover:bg-panel flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-[14px]"
              >
                <input
                  type="checkbox"
                  name="targetCountries"
                  value={item.code}
                  defaultChecked={initial.targetCountries.includes(item.code)}
                  className="h-4 w-4 accent-[var(--color-brand)]"
                />
                {countryName(item.code)}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card className="grid gap-4 p-5 sm:grid-cols-3">
        <Field id="ticketMin" label={t("ticketMin")} error={fieldErrors.ticketMin}>
          <Input
            id="ticketMin"
            name="ticketMin"
            defaultValue={initial.ticketMin}
            placeholder="500 000"
          />
        </Field>

        <Field id="ticketMax" label={t("ticketMax")} error={fieldErrors.ticketMax}>
          <Input
            id="ticketMax"
            name="ticketMax"
            defaultValue={initial.ticketMax}
            placeholder="5 000 000"
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

        <label className="text-ink flex cursor-pointer items-center gap-2 text-[14px] sm:col-span-3">
          <input
            type="checkbox"
            name="needsActiveLicense"
            defaultChecked={initial.needsActiveLicense}
            className="h-4 w-4 accent-[var(--color-brand)]"
          />
          {t("needsActive")}
        </label>
      </Card>

      <Card className="p-5">
        <Field
          id="visibility"
          label={tb("visibility")}
          hint={t("visibilityHint")}
          error={fieldErrors.visibility}
        >
          <Select id="visibility" name="visibility" defaultValue={initial.visibility}>
            {(["PUBLIC", "VERIFIED_ONLY", "HIDDEN"] as const).map((value) => (
              <option key={value} value={value}>
                {VISIBILITY_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="about"
          label={t("about")}
          hint={t("aboutHint")}
          error={fieldErrors.about}
          className="mt-4"
        >
          <Textarea
            id="about"
            name="about"
            defaultValue={initial.about}
            maxLength={2000}
          />
        </Field>
      </Card>

      {formError ? (
        <p
          role="alert"
          className="border-danger/20 bg-danger-soft text-danger rounded-xl border px-3.5 py-2.5 text-[14px] font-medium"
        >
          {formError}
        </p>
      ) : null}

      <SaveButton label={tc("save")} pendingLabel={tc("saving")} />
    </form>
  );
}
