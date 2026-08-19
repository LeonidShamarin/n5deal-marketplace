import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

// Locale routing only. Authorisation deliberately does NOT live here: the
// middleware runs on the edge runtime, where Prisma and bcrypt cannot, and a
// redirect in middleware is cosmetic anyway. Every real permission check sits in
// the server action or the page that touches the data.
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals and anything with a file extension.
  matcher: ["/((?!api|_next|_vercel|.*\..*).*)"],
};
