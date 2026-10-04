import { and, asc, desc, eq, gte, lte, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { db } from "@/db";
import { listings, listingImages } from "@/db/schema/listings";
import { makes, models } from "@/db/schema/taxonomy";
import { cities } from "@/db/schema/geo";
import { dealers, users } from "@/db/schema/users";
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
  publishedAt: Date | string | null;
  primaryImageKey: string | null;
  sellerType?: string | null;
  dealerName?: string | null;
  dealerVerifiedAt?: Date | null;
}

export interface SearchResult {
  rows: SearchResultRow[];
  total: number;
  page: number;
  pageCount: number;
}

export function buildWhere(state: FacetState): SQL[] {
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

  if (state.vertical === "part") {
    if (state.category) {
      clauses.push(sql`EXISTS (
        SELECT 1 FROM part_details pd
        WHERE pd.listing_id = ${listings.id}
          AND pd.category_id IN (
            WITH RECURSIVE category_tree AS (
              SELECT id FROM part_categories WHERE id = ${state.category.id}
              UNION ALL
              SELECT pc.id FROM part_categories pc
              JOIN category_tree ct ON pc.parent_id = ct.id
            ) SELECT id FROM category_tree
          )
      )`);
    }
    if (state.condition) {
      clauses.push(sql`EXISTS (SELECT 1 FROM part_details pd WHERE pd.listing_id = ${listings.id} AND pd.condition::text = ${state.condition})`);
    }
    if (state.keyword) {
      const term = `%${state.keyword}%`;
      clauses.push(sql`(
        ${listings.title} ILIKE ${term}
        OR COALESCE(${listings.description}, '') ILIKE ${term}
        OR EXISTS (
          SELECT 1 FROM part_details pd
          WHERE pd.listing_id = ${listings.id}
            AND (COALESCE(pd.brand, '') ILIKE ${term}
              OR COALESCE(pd.part_number, '') ILIKE ${term}
              OR COALESCE(pd.oem_number, '') ILIKE ${term}
              OR COALESCE(pd.custom_category_name, '') ILIKE ${term})
        )
      )`);
    }
    if (state.areaId) clauses.push(eq(listings.areaId, state.areaId));
    if (state.compatibleMakeId) {
      clauses.push(sql`EXISTS (SELECT 1 FROM part_details pd WHERE pd.listing_id = ${listings.id} AND pd.compatible_make_id = ${state.compatibleMakeId})`);
    }
    if (state.compatibleModelId) {
      clauses.push(sql`EXISTS (SELECT 1 FROM part_details pd WHERE pd.listing_id = ${listings.id} AND pd.compatible_model_id = ${state.compatibleModelId})`);
    }
    if (state.compatibleYear) {
      clauses.push(sql`EXISTS (
        SELECT 1 FROM part_details pd WHERE pd.listing_id = ${listings.id}
          AND (pd.compatible_year_from IS NULL OR pd.compatible_year_from <= ${state.compatibleYear})
          AND (pd.compatible_year_to IS NULL OR pd.compatible_year_to >= ${state.compatibleYear})
      )`);
    }
    if (state.brand) {
      clauses.push(sql`EXISTS (SELECT 1 FROM part_details pd WHERE pd.listing_id = ${listings.id} AND LOWER(pd.brand) = LOWER(${state.brand}))`);
    }
    if (state.partOrigin) {
      clauses.push(sql`EXISTS (SELECT 1 FROM part_details pd WHERE pd.listing_id = ${listings.id} AND pd.part_origin = ${state.partOrigin})`);
    }
    if (state.sellerType) {
      clauses.push(sql`${listings.sellerId} IN (SELECT id FROM users WHERE type::text = ${state.sellerType})`);
    }
    if (state.inStock) {
      clauses.push(sql`EXISTS (SELECT 1 FROM part_details pd WHERE pd.listing_id = ${listings.id} AND pd.stock_qty > 0)`);
    }
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

function buildOrderBy(sort: SortKey, columns: {pricePkr:SQLWrapper;year:SQLWrapper;mileageKm:SQLWrapper;publishedAt:SQLWrapper;id:SQLWrapper}=listings) {
  const primary = (() => {
    switch (sort) {
      case "price_asc":
        return asc(columns.pricePkr);
      case "price_desc":
        return desc(columns.pricePkr);
      case "year_desc":
        return desc(columns.year);
      case "year_asc":
        return asc(columns.year);
      case "mileage_asc":
        return asc(columns.mileageKm);
      case "recent":
      default:
        return desc(columns.publishedAt);
    }
  })();

  return [primary, desc(columns.id)];
}

export async function searchListings(
  state: FacetState,
  options: { previewLimit?: number } = {},
): Promise<SearchResult> {
  const pageSize = options.previewLimit === undefined ? PAGE_SIZE : Math.max(1, Math.min(PAGE_SIZE, Math.floor(options.previewLimit)));
  const page = Math.max(1, state.page ?? 1);
  const sort = (state.sort as SortKey) ?? "recent";
  const where = and(...buildWhere(state));

  // Pagination precedes enrichment, so deep pages don't join thousands of
  // discarded ads. MIN preserves deterministic duplicate-position photo behavior.
  const listingPage=db.$with("listing_page").as(db.select().from(listings).where(where)
    .orderBy(...buildOrderBy(sort)).limit(pageSize).offset((page-1)*pageSize));
  const rows = await db
    .with(listingPage)
    .select({
      id: listingPage.id,
      slug: listingPage.slug,
      title: listingPage.title,
      pricePkr: listingPage.pricePkr,
      year: listingPage.year,
      mileageKm: listingPage.mileageKm,
      cityName: cities.name,
      makeName: makes.name,
      modelName: models.name,
      fuel: sql<string | null>`${listingPage.fuel}::text`,
      transmission: sql<string | null>`${listingPage.transmission}::text`,
      engineCc: listingPage.engineCc,
      publishedAt: listingPage.publishedAt,
      primaryImageKey: sql<string | null>`(SELECT MIN(storage_key) FROM ${listingImages} WHERE listing_id=${listingPage.id} AND position=0)`,
      sellerType: sql<string>`${users.type}::text`,
      dealerName: dealers.businessName,
      dealerVerifiedAt: dealers.verifiedAt,
    })
    .from(listingPage)
    .innerJoin(cities, eq(listingPage.cityId, cities.id))
    .innerJoin(users, eq(listingPage.sellerId, users.id))
    .leftJoin(dealers, eq(listingPage.dealerId, dealers.id))
    .leftJoin(makes, eq(listingPage.makeId, makes.id))
    .leftJoin(models, eq(listingPage.modelId, models.id))
    .orderBy(...buildOrderBy(sort,listingPage));

  // Homepage previews have no pagination and do not need an inventory count.
  if (options.previewLimit !== undefined) {
    return { rows, total: rows.length, page, pageCount: 1 };
  }

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
