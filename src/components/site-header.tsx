import { getLocale, getTranslations } from "next-intl/server";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { NavLink } from "@/components/nav-link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/vocabulary";
import { signOutAction } from "@/server/actions/auth";

/**
 * The header is the only place that knows which sections a role can see. It is
 * navigation, not authorisation — every page it links to checks the role again
 * on the server, so removing a link here would hide a section without securing it.
 */
export async function SiteHeader() {
  const [t, locale, user] = await Promise.all([
    getTranslations("nav"),
    getLocale(),
    getCurrentUser(),
  ]);

  const links: Array<{ href: string; label: string }> = [
    { href: "/assets", label: t("assets") },
  ];

  if (user?.role === "SELLER" || user?.role === "MANAGER") {
    links.push({ href: "/buyers", label: t("buyers") });
  }
  if (user) {
    links.push({ href: "/dashboard", label: t("dashboard") });
    links.push({ href: "/inbox", label: t("inbox") });
  }
  if (user?.role === "MANAGER") {
    links.push({ href: "/moderation", label: t("moderation") });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-[15px] font-bold text-white"
          >
            N5
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-[15px] font-bold text-ink">deal</span>
            <span className="block text-[10px] font-medium uppercase tracking-wide text-faint">
              M&amp;A Deals Platform
            </span>
          </span>
        </Link>

        <nav className="min-w-0 flex-1 overflow-x-auto">
          <ul className="flex items-center gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <NavLink href={link.href}>{link.label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <LocaleSwitcher />

          {user ? (
            <>
              <div className="hidden text-right leading-tight md:block">
                <div className="max-w-[160px] truncate text-[13px] font-semibold text-ink">
                  {user.name}
                </div>
                <Badge tone="brand">{ROLE_LABELS[user.role]}</Badge>
              </div>
              <form action={signOutAction}>
                <input type="hidden" name="locale" value={locale} />
                <Button type="submit" variant="subtle" size="sm">
                  {t("signOut")}
                </Button>
              </form>
            </>
          ) : (
            <Link
              href="/sign-in"
              className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-ink/90"
            >
              {t("signIn")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
