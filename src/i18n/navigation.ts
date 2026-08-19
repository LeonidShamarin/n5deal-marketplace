import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware replacements for next/link and the router hooks. Importing these
// instead of next/navigation is what keeps the locale prefix on every internal
// link without spelling it out at each call site.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
