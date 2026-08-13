import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { makes } from "@/db/schema/taxonomy";
import { cities } from "@/db/schema/geo";
import { abs } from "@/lib/seo/jsonld";
import { estimateValue, comparableListings } from "@/lib/pricing/estimate";
import { formatPkr, formatPkrExact, formatMileage } from "@/lib/format";
import { buildListingPath } from "@/lib/listings/slug";
import { CalculatorForm } from "./CalculatorForm";

export const metadata: Metadata = {
  title: "Car Price Calculator Pakistan — What Is My Car Worth? | AutoBazaar",
  description:
    "Find out what your car is worth today, based on real asking and sold prices for the same variant, year and city. Free, instant, no signup.",
  alternates: { canonical: abs("/price-calculator") },
};

/**
 * Public valuation tool.
 *
 * "What is my car worth" is one of the highest-volume searches in this
 * market. Answering it well is a real service AND the cheapest possible
 * top-of-funnel — someone who has just valued their car is a seller about to
 * list one.
 *
 * State lives in the query string so a valuation is a shareable, indexable,
 * back-button-friendly URL rather than trapped in client state.
 */
export default async function PriceCalculatorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const variantId = Number(sp.variantId);
  const year = Number(sp.year);
  const cityId = Number(sp.cityId);
  const mileageKm = Number(sp.mileage);

  const [makeRows, cityRows] = await Promise.all([
    db
      .select({ id: makes.id, name: makes.name })
      .from(makes)
      .where(and(eq(makes.vertical, "car"), eq(makes.isActive, true)))
      .orderBy(desc(makes.popularity), asc(makes.name)),
    db
      .select({ id: cities.id, name: cities.name })
      .from(cities)
      .orderBy(desc(cities.popularity), asc(cities.name)),
  ]);

  const hasQuery =
    Number.isSafeInteger(variantId) && variantId > 0 && Number.isSafeInteger(year) && year > 1900;

  const cityName = cityRows.find((c) => c.id === cityId)?.name;

  const estimate = hasQuery
    ? await estimateValue({
        variantId,
        year,
        cityId: Number.isSafeInteger(cityId) && cityId > 0 ? cityId : undefined,
        cityName,
        mileageKm: Number.isSafeInteger(mileageKm) && mileageKm > 0 ? mileageKm : undefined,
        modelName: sp.modelName,
      })
    : null;

  const comparables = hasQuery ? await comparableListings(variantId, year) : [];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
        What is my car worth?
      </h1>
      <p className="mb-6 mt-2 text-slate-600">
        Based on what the same variant, year and city is actually selling for
        right now — not a guess from a depreciation table.
      </p>

      <CalculatorForm makes={makeRows} cities={cityRows} />

      {hasQuery && (
        <section className="mt-8">
          {estimate ? (
            <>
              <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
                <p className="text-sm text-slate-500">Estimated market value</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">
                  {formatPkr(estimate.midPkr)}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Most sell between {formatPkr(estimate.lowPkr)} and{" "}
                  {formatPkr(estimate.highPkr)}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  Based on {estimate.basis}
                </p>
                {estimate.medianDaysToSell != null && (
                  <p className="mt-1 text-xs text-slate-500">
                    Typically sells in about {estimate.medianDaysToSell} days
                  </p>
                )}
                {estimate.adjustments.length > 0 && (
                  <ul className="mt-2 text-xs text-slate-500">
                    {estimate.adjustments.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                )}

                <Link
                  href="/sell"
                  className="mt-5 inline-block rounded bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Sell it — post a free ad
                </Link>
              </div>

              {comparables.length > 0 && (
                <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
                  <h2 className="text-base font-semibold text-slate-900">
                    Cars we compared against
                  </h2>
                  <p className="mb-3 mt-0.5 text-xs text-slate-500">
                    Live listings for the same variant and year.
                  </p>
                  <ul className="divide-y divide-slate-100">
                    {comparables.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                        <Link
                          href={buildListingPath("car", c.slug, c.id)}
                          className="line-clamp-1 text-sm text-slate-700 hover:text-blue-700"
                        >
                          {c.title}
                        </Link>
                        <span className="shrink-0 text-sm">
                          <span className="font-semibold text-slate-900">
                            {formatPkrExact(c.pricePkr)}
                          </span>
                          <span className="ml-2 text-xs text-slate-400">
                            {formatMileage(c.mileageKm)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            /*
             * No fabricated number. A made-up valuation is worse than none,
             * because the user acts on it — they price their car wrong, or
             * turn down a fair offer.
             */
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-center">
              <p className="font-medium text-amber-900">
                Not enough data for that exact car yet
              </p>
              <p className="mt-1 text-sm text-amber-900">
                We only publish a valuation when we have enough comparable
                listings to stand behind it. Try a more common variant or year,
                or check back as more cars are listed.
              </p>
            </div>
          )}
        </section>
      )}

      <section className="mt-10 text-sm text-slate-600">
        <h2 className="mb-2 text-base font-semibold text-slate-900">
          How this is calculated
        </h2>
        <p>
          We take every live and recently sold listing for the same variant and
          model year, and read off the 25th, 50th and 75th percentile asking
          price. Where we have enough listings in your city we use those;
          otherwise we fall back to the national figure and say so. Mileage
          well outside the norm nudges the range by up to 8%.
        </p>
        <p className="mt-2">
          It is an estimate of what the market is asking, not an offer, and it
          cannot see your car&apos;s condition or accident history. For that,{" "}
          <Link href="/inspection" className="text-blue-700 hover:underline">
            book an inspection
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
