"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/primitives";
import { useRouter } from "@/i18n/navigation";
import { signInAction } from "@/server/actions/auth";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  // `useFormStatus` reads the state of the enclosing form, which is why the
  // button is its own component — a hook in the parent would always report idle.
  const { pending } = useFormStatus();
  return (
    <Button type="submit" full disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function SignInForm({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const router = useRouter();

  const [state, formAction] = useActionState(signInAction, null);

  // Navigation happens here rather than inside the action: signIn() sets the
  // session cookie on the action response, and redirecting from the client
  // afterwards guarantees the next request carries it.
  useEffect(() => {
    if (state?.ok) {
      router.replace("/dashboard");
      router.refresh();
    }
  }, [state, router]);

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const formError =
    state && !state.ok && state.fieldErrors === undefined ? state.message : null;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />

      <Field id="email" label={t("email")} error={fieldErrors?.email} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={fieldErrors?.email ? true : undefined}
          placeholder="buyer@n5deal.demo"
        />
      </Field>

      <Field id="password" label={t("password")} error={fieldErrors?.password} required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={fieldErrors?.password ? true : undefined}
        />
      </Field>

      {formError ? (
        <p
          role="alert"
          className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-[14px] font-medium text-danger"
        >
          {formError}
        </p>
      ) : null}

      <SubmitButton label={t("submit")} pendingLabel={tc("loading")} />
    </form>
  );
}
