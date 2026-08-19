import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SignInForm } from "@/components/sign-in-form";
import { Card } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";
import { getCurrentUser } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/vocabulary";

export default async function SignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Already signed in: there is nothing useful on this page for them.
  const user = await getCurrentUser();
  if (user) redirect(`/${locale}/dashboard`);

  const t = await getTranslations("auth");

  return (
    <div className="mx-auto max-w-[440px] px-4 py-14">
      <h1 className="text-[26px] font-bold text-ink">{t("signInTitle")}</h1>
      <p className="mt-1.5 text-[15px] text-muted">{t("signInSubtitle")}</p>

      <Card className="mt-6 p-6">
        <SignInForm locale={locale} />
      </Card>

      <Card className="mt-4 border-dashed bg-panel p-5">
        <p className="text-[13px] font-semibold text-ink">Demo accounts</p>
        <ul className="mt-2 space-y-1">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.key} className="flex justify-between gap-3 text-[13px]">
              <span className="truncate text-muted">{account.email}</span>
              <span className="shrink-0 font-medium text-ink">
                {ROLE_LABELS[account.role]}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[13px] text-faint">
          Password: <span className="font-mono font-semibold">{DEMO_PASSWORD}</span> —{" "}
          <Link href="/" className="font-semibold text-brand hover:underline">
            one-click sign-in is on the home page
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
