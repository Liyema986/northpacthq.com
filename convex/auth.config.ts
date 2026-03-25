import type { AuthConfig } from "convex/server";

/**
 * Convex auth: Clerk (primary) + Convex Auth (Password for /auth page).
 * - Set CLERK_JWT_ISSUER_DOMAIN in Convex Dashboard (Clerk JWT template "convex" Issuer URL).
 * - CONVEX_SITE_URL remains for Convex Auth (e.g. /auth page).
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
    {
      domain: process.env.CONVEX_SITE_URL!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
