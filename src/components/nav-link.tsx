"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * A nav item that knows whether it is the current section. The active pill is
 * the black one from the reference site. `usePathname` here is the locale-aware
 * version, so it returns "/assets" rather than "/en/assets" and the comparison
 * does not need to strip the prefix.
 */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 items-center rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition-colors",
        active ? "bg-ink text-white" : "text-muted hover:bg-panel hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
