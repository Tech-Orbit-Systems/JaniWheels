import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function isProductionDeployment(
  vercelEnv: string | undefined,
  nodeEnv: string | undefined,
): boolean {
  // Preview builds also set NODE_ENV=production; the deployment tier wins.
  return vercelEnv ? vercelEnv === "production" : nodeEnv === "production";
}

/**
 * robots.txt
 *
 * Deliberately short. The incumbent's is 90 lines of hand-maintained
 * Disallow rules for internal AJAX endpoints, including leftovers from a
 * vBulletin forum retired years ago and a developer TODO shipped to
 * production.
 *
 * That happens when robots.txt is doing a job the application should do.
 * Internal endpoints here live under /api and are noindex by header;
 * thin facet pages are handled by the indexation policy, not by pattern
 * matching URLs after the fact.
 */
export default function robots(): MetadataRoute.Robots {
  const isProduction = isProductionDeployment(
    process.env.VERCEL_ENV,
    process.env.NODE_ENV,
  );

  // Never let a staging deployment get indexed — a duplicate of your whole
  // catalogue on a second hostname is a genuinely expensive mistake.
  if (!isProduction) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/dashboard/",
          "/sell/",
          "/login",
          "/verify",
          "/saved",
          "/*?*sort=", // sorted views are noindex anyway; save the crawl budget
        ],
      },
    ],
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
    ],
    host: SITE_URL,
  };
}
