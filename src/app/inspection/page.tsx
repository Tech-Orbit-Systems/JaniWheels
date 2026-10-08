import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema/geo";
import { listings } from "@/db/schema/listings";
import { abs, serializeJsonLd } from "@/lib/seo/jsonld";
import { InspectionForm } from "./InspectionForm";
import { publicListingEligibility } from "@/lib/listings/public-eligibility";

export const metadata: Metadata = {
  title: "Request a Vehicle Inspection | JaniWheels",
  description:
    "Submit a vehicle inspection request and let the JaniWheels team contact you with availability and next steps.",
  alternates: { canonical: abs("/inspection") },
};

export default async function InspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ listingId?: string }>;
}) {
  const { listingId: rawListingId } = await searchParams;
  let linkedListing: { id: number; title: string } | undefined;
  if (rawListingId !== undefined) {
    const listingId = Number(rawListingId);
    if (!/^\d+$/.test(rawListingId) || !Number.isSafeInteger(listingId) || listingId < 1) notFound();
    const [listing] = await db.select({ id: listings.id, title: listings.title }).from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.vertical, "car"), publicListingEligibility()))
      .limit(1);
    if (!listing) notFound();
    linkedListing = listing;
  }
  const cityRows = await db
    .select({ id: cities.id, name: cities.name })
    .from(cities)
    .orderBy(desc(cities.popularity), asc(cities.name))
    .limit(24);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd({
            "@context": "https://schema.org",
            "@type": "Service",
            name: "Vehicle Inspection Request",
            serviceType: "Vehicle inspection request",
            areaServed: { "@type": "Country", name: "Pakistan" },
          }),
        }}
      />

      <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
        Request a vehicle inspection
      </h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Share the vehicle location and your contact number. The JaniWheels
        team will review your request and contact you to confirm availability,
        service details and next steps.
      </p>
      {linkedListing && <p className="mt-3 text-sm font-medium text-blue-800">For: {linkedListing.title}</p>}

      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Inspection request details
        </h2>
        <p className="mb-4 mt-1 text-sm text-slate-600">
          Submitting this form is a request only. It does not schedule an
          inspector or collect payment.
        </p>
        <InspectionForm cities={cityRows} listingId={linkedListing?.id} />
      </section>
    </main>
  );
}
