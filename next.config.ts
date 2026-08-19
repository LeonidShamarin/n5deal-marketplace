import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  typedRoutes: false,
  experimental: {
    // Enables forbidden() / unauthorized(), i.e. real 403 and 401 responses from a
    // server component instead of a redirect that pretends the page never existed.
    authInterrupts: true,
    // Server actions receive user input; keep the body small enough that a
    // stray upload cannot exhaust the function memory.
    serverActions: { bodySizeLimit: "1mb" },
  },
};

export default withNextIntl(nextConfig);
