import { getTranslations, setRequestLocale } from "next-intl/server";

import { NavLink } from "@/components/nav-link";
import { requireRole } from "@/lib/session";

/**
 * Everything under /moderation is manager-only, and the guard sits in the layout
 * so that adding a new sub-page cannot accidentally ship without it.
 */
export default async function ModerationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireRole("MANAGER");
  const t = await getTranslations("moderation");

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      <h1 className="text-[26px] font-bold text-ink">{t("title")}</h1>
      <p className="mt-1 text-[15px] text-muted">{t("subtitle")}</p>

      <nav className="mt-5 border-b border-line pb-3">
        <ul className="flex flex-wrap gap-1">
          <li>
            <NavLink href="/moderation/participants">{t("tabParticipants")}</NavLink>
          </li>
          <li>
            <NavLink href="/moderation/assets">{t("tabAssets")}</NavLink>
          </li>
          <li>
            <NavLink href="/moderation/audit">{t("tabAudit")}</NavLink>
          </li>
        </ul>
      </nav>

      <div className="mt-6">{children}</div>
    </div>
  );
}
