import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { dealers, users } from "@/db/schema/users";
import { listings, listingImages } from "@/db/schema/listings";
import { cities } from "@/db/schema/geo";
import { makes, models } from "@/db/schema/taxonomy";
import { ListingCard } from "@/components/ListingCard";
import { abs, breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { PAGE_SIZE } from "@/lib/listings/search";

/**
 * Dealer storefront.
 *
 * Indexable, unlike the seller dashboard — a dealer's inventory page is a
 * genuine landing page ("Al-Karam Motors Lahore"), and it is also the thing
 * you are selling them in the Showroom plan. Branded storefronts are the
 * single feature dealers reliably pay for, alongside bulk upload.
 */

async function getDealer(slug: string) {
  const [row] = await db
    .select({
      id: dealers.id,
      businessName: dealers.businessName,
      slug: dealers.slug,
      about: dealers.about,
      address: dealers.address,
      logoUrl: dealers.logoUrl,
      verifiedAt: dealers.verifiedAt,
      cityName: cities.name,
      memberSince: users.createdAt,
    })
    .from(dealers)
    .innerJoin(cities, eq(dealers.cityId, cities.id))
    .innerJoin(users, eq(dealers.userId, users.id))
    .where(eq(dealers.slug, slug))
    .limit(1);

  return row ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dealer = await getDealer(slug);
  if (!dealer) return { title: "Dealer not found" };

  return {
    title: `${dealer.businessName} — Used Cars in ${dealer.cityName} | JaniWheels`,
    description:
      dealer.about?.slice(0, 155) ??
      `Browse used cars for sale by ${dealer.businessName} in ${dealer.cityName}.`,
    alternates: { canonical: abs(`/dealers/${dealer.slug}`) },
  };
}

export default async function DealerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: rawPage } = await searchParams;
  const dealer = await getDealer(slug);
  if (!dealer) notFound();

  const page = Math.max(1, Number(rawPage ?? 1) || 1);

  const rows = await db
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
      primaryImageKey: sql<string | null>`(
        SELECT storage_key FROM ${listingImages}
        WHERE listing_id = ${listings.id} ORDER BY position LIMIT 1
      )`,
    })
    .from(listings)
    .innerJoin(cities, eq(listings.cityId, cities.id))
    .leftJoin(makes, eq(listings.makeId, makes.id))
    .leftJoin(models, eq(listings.modelId, models.id))
    .where(
      and(eq(listings.dealerId, dealer.id), eq(listings.status, "active")),
    )
    .orderBy(desc(listings.bumpedAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Dealers", path: "/dealers" },
    { name: dealer.businessName, path: `/dealers/${dealer.slug}` },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "AutoDealer",
            name: dealer.businessName,
            url: abs(`/dealers/${dealer.slug}`),
            address: {
              "@type": "PostalAddress",
              streetAddress: dealer.address ?? undefined,
              addressLocality: dealer.cityName,
              addressCountry: "PK",
            },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd(crumbs)),
        }}
      />

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">
            {dealer.businessName}
          </h1>
          {dealer.verifiedAt && (
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
              Verified dealer
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {dealer.address ? `${dealer.address}, ` : ""}
          {dealer.cityName} · member since{" "}
          {dealer.memberSince.getFullYear()}
        </p>
        {dealer.about && (
          <p className="mt-3 text-sm text-slate-700">{dealer.about}</p>
        )}
      </div>

      <h2 className="mb-3 text-lg font-semibold text-slate-900">
        {rows.length} car{rows.length === 1 ? "" : "s"} available
      </h2>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600">
          This dealer has no live listings right now.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <ListingCard key={row.id} row={row} vertical="car" />
          ))}
        </ul>
      )}
    </main>
  );
}
