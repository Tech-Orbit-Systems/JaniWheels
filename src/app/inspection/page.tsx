import type { Metadata } from "next";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema/geo";
import { INSPECTION_PACKAGES } from "@/db/seed/commerce";
import { formatPkr } from "@/lib/format";
import { abs } from "@/lib/seo/jsonld";
import { InspectionForm } from "./InspectionForm";

export const metadata: Metadata = {
  title: "Car Inspection in Pakistan — 200+ Checkpoints | JaniWheels",
  description:
    "Book an independent 200-point car inspection before you buy. Engine, suspension, body and accident history, checked at your doorstep across 12 cities.",
  alternates: { canonical: abs("/inspection") },
};

/**
 * Inspection is the highest-margin thing in the model and the reason buyers
 * trust a listing at all — but the software is the easy tenth of it. The
 * rest is field operations: hiring inspectors, scheduling, travel, quality
 * control on the reports.
 */
export default async function InspectionPage() {
  const cityRows = await db
    .select({ id: cities.id, name: cities.name })
    .from(cities)
    .orderBy(desc(cities.popularity), asc(cities.name))
    .limit(24);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            name: "Car Inspection",
            serviceType: "Pre-purchase vehicle inspection",
            areaServed: { "@type": "Country", name: "Pakistan" },
            offers: INSPECTION_PACKAGES.map((p) => ({
              "@type": "Offer",
              name: p.name,
              price: p.pricePkr,
              priceCurrency: "PKR",
            })),
          }),
        }}
      />

      <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
        Never buy a used car on trust alone
      </h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        An independent engineer checks the car on 200+ points — engine,
        transmission, suspension, brakes, electricals, and accident history —
        and sends you a written report before you pay anyone anything.
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        {INSPECTION_PACKAGES.map((p) => (
          <div key={p.slug} className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">{p.name}</h2>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {formatPkr(p.pricePkr)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {p.checkpoints}+ checkpoints
            </p>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Book an inspection
          </h2>
          <p className="mb-4 mt-1 text-sm text-slate-600">
            We come to the car. Report by SMS and email, usually the same day.
          </p>
          <InspectionForm cities={cityRows} />
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              What gets checked
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              <li>Engine &amp; transmission, with fault-code scan</li>
              <li>Accident and repaint detection, panel by panel</li>
              <li>Suspension, steering and brakes</li>
              <li>Electricals, AC and interior</li>
              <li>Road test</li>
            </ul>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <h3 className="text-sm font-semibold text-slate-900">
              Independent by design
            </h3>
            <p className="mt-1">
              Our inspectors are paid by you, not by the seller, and they
              don&apos;t take a cut of the sale. The report says what the car
              actually is — including when the answer is &ldquo;walk
              away&rdquo;.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
