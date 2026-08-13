import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { priceSnapshots } from "@/db/schema/analytics";
import { listings } from "@/db/schema/listings";

/**
 * PUBLIC PRICE CALCULATOR
 *
 * "What is my car worth" is one of the highest-volume searches in this
 * market, and answering it is both a genuine service and the cheapest
 * top-of-funnel there is — someone who just valued their car is a seller
 * about to list.
 *
 * The estimate refuses to invent confidence it doesn't have. Below the
 * sample floor it returns `null` and the page says so, because a made-up
 * valuation is worse than none: the user acts on it.
 */

const MIN_SAMPLE = 5;

export interface Estimate {
  lowPkr: number;
  midPkr: number;
  highPkr: number;
  sampleSize: number;
  basis: string;
  medianDaysToSell: number | null;
  /** Adjustments we applied and why, shown to the user. */
  adjustments: string[];
}

export interface EstimateInput {
  variantId: number;
  year: number;
  cityId?: number;
  cityName?: string;
  mileageKm?: number;
  modelName?: string;
}

/**
 * Typical annual mileage in Pakistan. Used only to nudge the estimate for
 * cars well outside the norm — a 2019 car with 30,000 km is worth more than
 * the same car with 180,000 km, and a valuation that ignores that is wrong
 * in a way users notice immediately.
 */
const TYPICAL_KM_PER_YEAR = 14_000;

export async function estimateValue(
  input: EstimateInput,
): Promise<Estimate | null> {
  const rows = await db
    .select()
    .from(priceSnapshots)
    .where(
      and(
        eq(priceSnapshots.variantId, input.variantId),
        eq(priceSnapshots.year, input.year),
      ),
    )
    .orderBy(desc(priceSnapshots.computedAt))
    .limit(10);

  const cityRow = input.cityId
    ? rows.find((r) => r.cityId === input.cityId)
    : undefined;
  const nationalRow = rows.find((r) => r.cityId === null);

  const snapshot =
    cityRow && cityRow.sampleSize >= MIN_SAMPLE ? cityRow : nationalRow;

  if (!snapshot || snapshot.sampleSize < MIN_SAMPLE) return null;

  let low = snapshot.p25Pkr;
  let mid = snapshot.p50Pkr;
  let high = snapshot.p75Pkr;
  const adjustments: string[] = [];

  if (input.mileageKm !== undefined) {
    const age = Math.max(1, new Date().getFullYear() - input.year);
    const expected = age * TYPICAL_KM_PER_YEAR;
    const ratio = input.mileageKm / expected;

    // Capped at ±8%. Mileage matters, but not enough to justify a bigger
    // swing than the spread of the comparables themselves.
    if (ratio < 0.7) {
      const factor = 1 + Math.min(0.08, (0.7 - ratio) * 0.2);
      low = Math.round(low * factor);
      mid = Math.round(mid * factor);
      high = Math.round(high * factor);
      adjustments.push("Adjusted up for below-average mileage");
    } else if (ratio > 1.4) {
      const factor = 1 - Math.min(0.08, (ratio - 1.4) * 0.15);
      low = Math.round(low * factor);
      mid = Math.round(mid * factor);
      high = Math.round(high * factor);
      adjustments.push("Adjusted down for above-average mileage");
    }
  }

  const where = snapshot.cityId
    ? `in ${input.cityName ?? "your city"}`
    : "nationwide";

  return {
    lowPkr: low,
    midPkr: mid,
    highPkr: high,
    sampleSize: snapshot.sampleSize,
    basis: `${snapshot.sampleSize} comparable ${input.year} ${
      input.modelName ? `${input.modelName} listings` : "listings"
    } ${where}`,
    medianDaysToSell: snapshot.medianDaysToSell,
    adjustments,
  };
}

/** Live listings behind the estimate, so the user can sanity-check it. */
export async function comparableListings(
  variantId: number,
  year: number,
  limit = 6,
) {
  return db
    .select({
      id: listings.id,
      slug: listings.slug,
      title: listings.title,
      pricePkr: listings.pricePkr,
      mileageKm: listings.mileageKm,
    })
    .from(listings)
    .where(
      and(
        eq(listings.status, "active"),
        eq(listings.variantId, variantId),
        eq(listings.year, year),
      ),
    )
    .orderBy(listings.pricePkr)
    .limit(limit);
}

/** Years we actually hold data for, to populate the year picker honestly. */
export async function yearsWithData(variantId: number): Promise<number[]> {
  const rows = await db
    .selectDistinct({ year: priceSnapshots.year })
    .from(priceSnapshots)
    .where(
      and(
        eq(priceSnapshots.variantId, variantId),
        isNull(priceSnapshots.cityId),
        sql`${priceSnapshots.sampleSize} >= ${MIN_SAMPLE}`,
      ),
    )
    .orderBy(desc(priceSnapshots.year));

  return rows.map((r) => r.year).filter((y): y is number => y !== null);
}
