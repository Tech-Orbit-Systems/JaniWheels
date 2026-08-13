import type { Metadata } from "next";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema/geo";
import { abs } from "@/lib/seo/jsonld";
import { FinanceCalculator } from "./FinanceCalculator";

export const metadata: Metadata = {
  title: "Car Finance Pakistan — Compare Car Loan Plans | JaniWheels",
  description:
    "Work out your monthly car instalment and get matched with banks offering car finance in Pakistan. Free, no obligation.",
  alternates: { canonical: abs("/car-finance") },
};

export default async function CarFinancePage() {
  const cityRows = await db
    .select({ id: cities.id, name: cities.name })
    .from(cities)
    .orderBy(desc(cities.popularity), asc(cities.name))
    .limit(30);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
        Car finance
      </h1>
      <p className="mb-6 mt-2 text-slate-600">
        See what your monthly instalment would look like, then let partner
        banks come back to you with real offers.
      </p>

      <FinanceCalculator cities={cityRows} />

      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
        <h2 className="text-base font-semibold text-slate-900">
          How the numbers work
        </h2>
        <p className="mt-1">
          Car financing in Pakistan is usually quoted at a{" "}
          <strong>flat rate</strong>: the markup is calculated on the full
          amount for the whole term, not on the reducing balance. The
          calculator above uses the flat method so the figure matches what a
          bank will actually quote you.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          JaniWheels is not a lender and does not arrange credit. We pass your
          details to partner banks who will contact you with their own terms.
          Rates shown are illustrative — the rate you are offered depends on
          the bank, your income and your credit history.
        </p>
      </section>
    </main>
  );
}
