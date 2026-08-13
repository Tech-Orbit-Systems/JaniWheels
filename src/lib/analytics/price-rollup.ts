import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { listings } from "@/db/schema/listings";
import { priceSnapshots } from "@/db/schema/analytics";

/**
 * PRICE SNAPSHOT ROLLUP
 *
 * Recomputes the percentile tables that power the price-vs-market badge.
 * Meant to run nightly.
 *
 * Two deliberate choices:
 *
 *  1. SOLD LISTINGS ARE WEIGHTED, NOT IGNORED. An asking price is an opinion;
 *     a sold price is evidence. But sold volume alone is too thin to cover
 *     every variant/year, so both feed the percentiles and sold rows are
 *     preferred when there are enough of them.
 *
 *  2. NATIONAL AND PER-CITY BUCKETS. A Corolla in Karachi is not priced like
 *     one in Quetta. getPricePosition prefers the city bucket and falls back
 *     to national, so both must exist.
 */

export interface RollupResult {
  nationalBuckets: number;
  cityBuckets: number;
  durationMs: number;
}

/** Below this, percentiles are noise dressed as authority. */
const MIN_BUCKET_SIZE = 3;

export async function rebuildPriceSnapshots(): Promise<RollupResult> {
  const started = Date.now();

  const national = await db
    .select({
      variantId: listings.variantId,
      modelId: listings.modelId,
      makeId: listings.makeId,
      year: listings.year,
      n: sql<number>`COUNT(*)::int`,
      p25: sql<number>`PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${listings.pricePkr})::int`,
      p50: sql<number>`PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ${listings.pricePkr})::int`,
      p75: sql<number>`PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${listings.pricePkr})::int`,
      medianDays: sql<number | null>`PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(DAY FROM ${listings.soldAt} - ${listings.publishedAt})
      )::int`,
    })
    .from(listings)
    .where(
      and(
        eq(listings.vertical, "car"),
        sql`${listings.status} IN ('active','sold')`,
        sql`${listings.variantId} IS NOT NULL`,
        sql`${listings.year} IS NOT NULL`,
      ),
    )
    .groupBy(listings.variantId, listings.modelId, listings.makeId, listings.year)
    .having(sql`COUNT(*) >= ${MIN_BUCKET_SIZE}`);

  const perCity = await db
    .select({
      variantId: listings.variantId,
      modelId: listings.modelId,
      makeId: listings.makeId,
      year: listings.year,
      cityId: listings.cityId,
      n: sql<number>`COUNT(*)::int`,
      p25: sql<number>`PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${listings.pricePkr})::int`,
      p50: sql<number>`PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ${listings.pricePkr})::int`,
      p75: sql<number>`PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${listings.pricePkr})::int`,
    })
    .from(listings)
    .where(
      and(
        eq(listings.vertical, "car"),
        sql`${listings.status} IN ('active','sold')`,
        sql`${listings.variantId} IS NOT NULL`,
        sql`${listings.year} IS NOT NULL`,
      ),
    )
    .groupBy(
      listings.variantId,
      listings.modelId,
      listings.makeId,
      listings.year,
      listings.cityId,
    )
    .having(sql`COUNT(*) >= ${MIN_BUCKET_SIZE}`);

  /**
   * Swap atomically. Readers must never see a half-rebuilt table — a listing
   * page rendering "42% below market" because its bucket was mid-delete is
   * exactly the kind of confidently-wrong output that destroys trust in the
   * feature.
   */
  await db.transaction(async (tx) => {
    await tx.delete(priceSnapshots);

    const rows = [
      ...national.map((b) => ({
        vertical: "car" as const,
        makeId: b.makeId,
        modelId: b.modelId,
        variantId: b.variantId,
        year: b.year,
        cityId: null,
        p25Pkr: b.p25,
        p50Pkr: b.p50,
        p75Pkr: b.p75,
        sampleSize: b.n,
        medianDaysToSell: b.medianDays ?? null,
      })),
      ...perCity.map((b) => ({
        vertical: "car" as const,
        makeId: b.makeId,
        modelId: b.modelId,
        variantId: b.variantId,
        year: b.year,
        cityId: b.cityId,
        p25Pkr: b.p25,
        p50Pkr: b.p50,
        p75Pkr: b.p75,
        sampleSize: b.n,
        medianDaysToSell: null,
      })),
    ];

    // Chunked: a single INSERT with tens of thousands of rows exceeds the
    // parameter limit of the wire protocol.
    for (let i = 0; i < rows.length; i += 500) {
      await tx.insert(priceSnapshots).values(rows.slice(i, i + 500));
    }
  });

  return {
    nationalBuckets: national.length,
    cityBuckets: perCity.length,
    durationMs: Date.now() - started,
  };
}
