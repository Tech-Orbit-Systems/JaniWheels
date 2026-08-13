import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { priceSnapshots } from "@/db/schema/analytics";

/**
 * PRICE VS MARKET
 *
 * This is the feature the incumbent has never shipped despite owning all the
 * data for two decades, and it is the clearest reason for a buyer to prefer
 * your listing page over theirs.
 *
 * A buyer looking at "PKR 48 lacs" has no idea whether that is a bargain or
 * a fantasy. Telling them costs you one indexed lookup.
 *
 * Honesty constraints, which matter more than the feature:
 *   - Never show a verdict on a thin sample. Below MIN_SAMPLE it is noise
 *     dressed as authority, and being confidently wrong here destroys the
 *     trust the whole feature is meant to build.
 *   - Fall back national -> city, never the reverse.
 *   - Say what the comparison set was. "Below market" is a claim; "below the
 *     median of 34 similar cars in Lahore" is evidence.
 */

const MIN_SAMPLE = 8;

export type PriceVerdict =
  | "great_price"
  | "good_price"
  | "fair_price"
  | "above_market"
  | "unknown";

export interface PricePosition {
  verdict: PriceVerdict;
  /** Signed percentage difference from the median. -12 = 12% below. */
  deltaPct: number | null;
  medianPkr: number | null;
  sampleSize: number;
  /** Plain-English description of the comparison set, shown to the user. */
  basis: string | null;
}

export const UNKNOWN_POSITION: PricePosition = {
  verdict: "unknown",
  deltaPct: null,
  medianPkr: null,
  sampleSize: 0,
  basis: null,
};

export interface PricePositionInput {
  pricePkr: number;
  variantId: number | null;
  modelId: number | null;
  year: number | null;
  cityId: number | null;
  cityName?: string | null;
  modelName?: string | null;
}

export async function getPricePosition(
  input: PricePositionInput,
): Promise<PricePosition> {
  if (!input.variantId || !input.year) return UNKNOWN_POSITION;

  // Prefer the city-specific snapshot; fall back to the national one.
  const candidates = await db
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

  const cityMatch = input.cityId
    ? candidates.find((c) => c.cityId === input.cityId)
    : undefined;
  const national = candidates.find((c) => c.cityId === null);

  const snapshot =
    cityMatch && cityMatch.sampleSize >= MIN_SAMPLE ? cityMatch : national;

  if (!snapshot || snapshot.sampleSize < MIN_SAMPLE) return UNKNOWN_POSITION;

  const median = snapshot.p50Pkr;
  const deltaPct = ((input.pricePkr - median) / median) * 100;

  const verdict: PriceVerdict =
    input.pricePkr <= snapshot.p25Pkr
      ? "great_price"
      : deltaPct <= -5
        ? "good_price"
        : deltaPct <= 8
          ? "fair_price"
          : "above_market";

  const where = snapshot.cityId
    ? `in ${input.cityName ?? "this city"}`
    : "nationwide";
  const what = input.modelName
    ? `similar ${input.year} ${input.modelName} listings`
    : "similar listings";

  return {
    verdict,
    deltaPct: Math.round(deltaPct),
    medianPkr: median,
    sampleSize: snapshot.sampleSize,
    basis: `median of ${snapshot.sampleSize} ${what} ${where}`,
  };
}

export const VERDICT_LABEL: Record<PriceVerdict, string> = {
  great_price: "Great price",
  good_price: "Good price",
  fair_price: "Fair price",
  above_market: "Above market",
  unknown: "",
};
