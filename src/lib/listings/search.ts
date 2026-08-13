import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { listings, listingImages } from "@/db/schema/listings";
import { makes, models } from "@/db/schema/taxonomy";
import { cities } from "@/db/schema/geo";
import type { FacetState } from "@/lib/seo/facets";

/**
 * Search over listings.
 *
 * Deliberately plain SQL against Postgres for now. A dedicated search engine
 * (Typesense) earns its keep once you need typo tolerance and instant
 * as-you-type results — but not before, and adding it early means running two
 * sources of truth while you still have fewer listings than a single page of
 * results. The interface here is what you'd swap behind.
 */

export const PAGE_SIZE = 25;

export type SortKey =
  | "recent"
  | "price_asc"
  | "price_desc"
  | "year_desc"
  | "year_asc"
  | "mileage_asc";

export interface SearchResultRow {
  id: number;
  slug: string;
  title: string;
  pricePkr: number;
  year: number | null;
  mileageKm: number | null;
  cityName: string;
  makeName: string | null;
  modelName: string | null;
  fuel: string | null;
  transmission: string | null;
  engineCc: number | null;
  isFeatured: boolean;
  inspectionScore: number | null;
  bumpedAt: Date | null;
  primaryImageKey: string | null;
}

export interface SearchResult {
  rows: SearchResultRow[];
  total: number;
  page: number;
  pageCount: number;
}

function buildWhere(state: FacetState): SQL[] {
  const clauses: SQL[] = [
    eq(listings.vertical, state.vertical),
    eq(listings.status, "active"),
  ];

  if (state.model) clauses.push(eq(listings.modelId, state.model.id));
  else if (state.make) clauses.push(eq(listings.makeId, state.make.id));

  if (state.city) clauses.push(eq(listings.cityId, state.city.id));
  else if (state.province) {
    clauses.push(
      sql`${listings.cityId} IN (SELECT id FROM ${cities} WHERE province_id = ${state.province.id})`,
    );
  }

  if (state.bodyType)
    clauses.push(
      sql`${listings.bodyType}::text = ${state.bodyType.replace(/-/g, "_")}`,
    );
  if (state.transmission)
    clauses.push(sql`${listings.transmission}::text = ${state.transmission}`);
  if (state.fuel) clauses.push(sql`${listings.fuel}::text = ${state.fuel}`);
  if (state.assembly)
    clauses.push(sql`${listings.assembly}::text = ${state.assembly}`);

  if (state.origin) {
    clauses.push(
      sql`${listings.makeId} IN (SELECT id FROM ${makes} WHERE country_of_origin = ${state.origin})`,
    );
  }

  if (state.feature?.length) {
    /**
     * Every requested feature must be present, not any of them — a filter
     * that returns cars missing the feature the user asked for reads as
     * broken. Cheap correlated subquery on an indexed table.
     *
     * Note `IN (...)` built with sql.join, NOT `= ANY(${array})`. Drizzle
     * expands a JS array into a parameter tuple rather than a Postgres array
     * literal, so ANY() receives `'sunroof'` where it expects `{sunroof}`
     * and the query dies with "malformed array literal". Every feature facet
     * page 500s, and they are indexable.
     */
    clauses.push(
      sql`(
        SELECT COUNT(*) FROM listing_features lf
        JOIN features f ON f.id = lf.feature_id
        WHERE lf.listing_id = ${listings.id}
          AND f.slug IN (${sql.join(
            state.feature.map((f) => sql`${f}`),
            sql`, `,
          )})
      ) = ${state.feature.length}`,
    );
  }

  if (state.price?.min !== undefined)
    clauses.push(gte(listings.pricePkr, state.price.min));
  if (state.price?.max !== undefined)
    clauses.push(lte(listings.pricePkr, state.price.max));

  if (state.year?.min !== undefined)
    clauses.push(gte(listings.year, state.year.min));
  if (state.year?.max !== undefined)
    clauses.push(lte(listings.year, state.year.max));

  if (state.mileage?.min !== undefined)
    clauses.push(gte(listings.mileageKm, state.mileage.min));
  if (state.mileage?.max !== undefined)
    clauses.push(lte(listings.mileageKm, state.mileage.max));

  if (state.engine?.min !== undefined)
    clauses.push(gte(listings.engineCc, state.engine.min));
  if (state.engine?.max !== undefined)
    clauses.push(lte(listings.engineCc, state.engine.max));

  return clauses;
}

/**
 * Featured listings always sort first, then the chosen ordering.
 *
 * Note it sorts on `bumpedAt`, not `createdAt`. "Bump to top" is a paid
 * product; if the default sort ignored it, the thing sellers are paying for
 * would not visibly happen.
 */
function buildOrderBy(sort: SortKey) {
  const featuredFirst = sql`(${listings.featuredUntil} IS NOT NULL AND ${listings.featuredUntil} > NOW()) DESC`;

  const secondary = (() => {
    switch (sort) {
      case "price_asc":
        return asc(listings.pricePkr);
      case "price_desc":
        return desc(listings.pricePkr);
      case "year_desc":
        return desc(listings.year);
      case "year_asc":
        return asc(listings.year);
      case "mileage_asc":
        return asc(listings.mileageKm);
      case "recent":
      default:
        return desc(sql`COALESCE(${listings.bumpedAt}, ${listings.publishedAt})`);
    }
  })();

  return [featuredFirst, secondary, desc(listings.id)];
}

export async function searchListings(
  state: FacetState,
): Promise<SearchResult> {
  const page = Math.max(1, state.page ?? 1);
  const sort = (state.sort as SortKey) ?? "recent";
  const where = and(...buildWhere(state));

  /**
   * Primary image is fetched with a LATERAL join rather than a second query
   * per row. With 25 rows a page, the N+1 version is 25 extra round trips on
   * the hottest page in the product.
   */
  const primaryImage = db
    .$with("primary_image")
    .as(
      db
        .select({
          listingId: listingImages.listingId,
          storageKey: sql<string>`MIN(${listingImages.storageKey})`.as(
            "storage_key",
          ),
        })
        .from(listingImages)
        .where(eq(listingImages.position, 0))
        .groupBy(listingImages.listingId),
    );

  const rows = await db
    .with(primaryImage)
    .select({
      id: listings.id,
      slug: listings.slug,
      title: listings.title,
      pricePkr: listings.pricePkr,
      year: listings.year,
      mileageKm: listings.mileageKm,
      cityName: cities.name,
      makeName: makes.name,
      modelName: models.name,
      fuel: sql<string | null>`${listings.fuel}::text`,
      transmission: sql<string | null>`${listings.transmission}::text`,
      engineCc: listings.engineCc,
      isFeatured: sql<boolean>`(${listings.featuredUntil} IS NOT NULL AND ${listings.featuredUntil} > NOW())`,
      inspectionScore: listings.inspectionScore,
      bumpedAt: listings.bumpedAt,
      primaryImageKey: sql<string | null>`${primaryImage.storageKey}`,
    })
    .from(listings)
    .innerJoin(cities, eq(listings.cityId, cities.id))
    .leftJoin(makes, eq(listings.makeId, makes.id))
    .leftJoin(models, eq(listings.modelId, models.id))
    .leftJoin(primaryImage, eq(primaryImage.listingId, listings.id))
    .where(where)
    .orderBy(...buildOrderBy(sort))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(listings)
    .where(where);

  return {
    rows,
    total: count,
    page,
    pageCount: Math.max(1, Math.ceil(count / PAGE_SIZE)),
  };
}

/** Cheap count used by the sitemap generator to skip thin facet pages. */
export async function countListings(state: FacetState): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(listings)
    .where(and(...buildWhere(state)));
  return count;
}
