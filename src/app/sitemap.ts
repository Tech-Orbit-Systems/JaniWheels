import type { MetadataRoute } from "next";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { listings } from "@/db/schema/listings";
import { makes, models } from "@/db/schema/taxonomy";
import { cities } from "@/db/schema/geo";
import { dealers } from "@/db/schema/users";
import { buildPath } from "@/lib/seo/facets";
import { buildListingPath } from "@/lib/listings/slug";
import { MIN_LISTINGS_FOR_INDEXABLE_PAGE } from "@/lib/seo/indexation";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Sitemap.
 *
 * Two rules that matter more than completeness:
 *
 *  1. Only emit URLs that are actually indexable. A sitemap listing pages you
 *     have marked noindex sends Google contradictory instructions and wastes
 *     the crawl budget you are trying to direct.
 *
 *  2. Only emit facet pages with real inventory behind them. A model x city
 *     page with two cars on it is a thin page; a few thousand of them drag
 *     the whole domain's quality signal down. The threshold lives in
 *     MIN_LISTINGS_FOR_INDEXABLE_PAGE.
 *
 * Next's sitemap route caps at 50,000 URLs. Once listings alone exceed that,
 * split this into generateSitemaps() shards by vertical — the structure below
 * is already grouped for it.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/used-cars`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/used-bikes`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${SITE_URL}/auto-parts`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/inspection`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/sell-my-car`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/dealers`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/dealers/register`, changeFrequency: "monthly", priority: 0.5 },
  ];

  // --- dealer storefronts --------------------------------------------------
  const dealerRows = await db
    .select({ slug: dealers.slug, n: sql<number>`COUNT(${listings.id})::int` })
    .from(dealers)
    .leftJoin(
      listings,
      and(eq(listings.dealerId, dealers.id), eq(listings.status, "active")),
    )
    .groupBy(dealers.slug)
    .having(sql`COUNT(${listings.id}) >= 1`);

  for (const d of dealerRows) {
    entries.push({
      url: `${SITE_URL}/dealers/${d.slug}`,
      changeFrequency: "daily",
      priority: 0.6,
    });
  }

  // --- model pages, with a live-inventory floor ----------------------------
  const modelCounts = await db
    .select({
      id: models.id,
      slug: models.slug,
      name: models.name,
      makeSlug: makes.slug,
      n: sql<number>`COUNT(${listings.id})::int`,
    })
    .from(models)
    .innerJoin(makes, eq(models.makeId, makes.id))
    .leftJoin(
      listings,
      and(eq(listings.modelId, models.id), eq(listings.status, "active")),
    )
    .where(eq(models.vertical, "car"))
    .groupBy(models.id, models.slug, models.name, makes.slug)
    .having(sql`COUNT(${listings.id}) >= ${MIN_LISTINGS_FOR_INDEXABLE_PAGE}`);

  for (const m of modelCounts) {
    entries.push({
      url: `${SITE_URL}${buildPath({
        vertical: "car",
        model: { id: m.id, slug: m.slug, name: m.name, makeSlug: m.makeSlug },
      })}`,
      changeFrequency: "daily",
      priority: 0.8,
    });
  }

  // --- city pages ----------------------------------------------------------
  const cityCounts = await db
    .select({
      id: cities.id,
      slug: cities.slug,
      name: cities.name,
      n: sql<number>`COUNT(${listings.id})::int`,
    })
    .from(cities)
    .leftJoin(
      listings,
      and(eq(listings.cityId, cities.id), eq(listings.status, "active")),
    )
    .groupBy(cities.id, cities.slug, cities.name)
    .having(sql`COUNT(${listings.id}) >= ${MIN_LISTINGS_FOR_INDEXABLE_PAGE}`);

  for (const c of cityCounts) {
    entries.push({
      url: `${SITE_URL}${buildPath({ vertical: "car", city: c })}`,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  // --- model x city: the highest-intent pages on the site ------------------
  const modelCity = await db
    .select({
      modelId: models.id,
      modelSlug: models.slug,
      modelName: models.name,
      makeSlug: makes.slug,
      cityId: cities.id,
      citySlug: cities.slug,
      cityName: cities.name,
      n: sql<number>`COUNT(${listings.id})::int`,
    })
    .from(listings)
    .innerJoin(models, eq(listings.modelId, models.id))
    .innerJoin(makes, eq(models.makeId, makes.id))
    .innerJoin(cities, eq(listings.cityId, cities.id))
    .where(and(eq(listings.status, "active"), eq(listings.vertical, "car")))
    .groupBy(
      models.id,
      models.slug,
      models.name,
      makes.slug,
      cities.id,
      cities.slug,
      cities.name,
    )
    .having(sql`COUNT(${listings.id}) >= ${MIN_LISTINGS_FOR_INDEXABLE_PAGE}`);

  for (const mc of modelCity) {
    entries.push({
      url: `${SITE_URL}${buildPath({
        vertical: "car",
        model: {
          id: mc.modelId,
          slug: mc.modelSlug,
          name: mc.modelName,
          makeSlug: mc.makeSlug,
        },
        city: { id: mc.cityId, slug: mc.citySlug, name: mc.cityName },
      })}`,
      changeFrequency: "daily",
      priority: 0.85,
    });
  }

  // --- listing detail pages ------------------------------------------------
  const live = await db
    .select({
      id: listings.id,
      slug: listings.slug,
      vertical: listings.vertical,
      updatedAt: listings.updatedAt,
    })
    .from(listings)
    .where(eq(listings.status, "active"))
    .orderBy(desc(listings.updatedAt))
    .limit(45000);

  for (const l of live) {
    entries.push({
      url: `${SITE_URL}${buildListingPath(l.vertical, l.slug, l.id)}`,
      lastModified: l.updatedAt,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  return entries;
}
