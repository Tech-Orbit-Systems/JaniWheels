import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { savedListings } from "@/db/schema/analytics";
import { listings } from "@/db/schema/listings";
import { cities } from "@/db/schema/geo";
import { getCurrentUser } from "@/lib/auth/session";
import { ListingCard } from "@/components/ListingCard";

export const metadata: Metadata = { title: "Saved ads", robots: { index: false, follow: false } };
export default async function SavedAdsPage() {
  const user = await getCurrentUser(); if (!user) redirect("/login?next=/dashboard/saved");
  const rows = await db.select({
    id: listings.id, slug: listings.slug, title: listings.title, pricePkr: listings.pricePkr,
    year: listings.year, mileageKm: listings.mileageKm, cityName: cities.name,
    makeName: listings.customMakeName, modelName: listings.customModelName,
    fuel: listings.fuel, transmission: listings.transmission, engineCc: listings.engineCc,
    publishedAt: listings.publishedAt,
    primaryImageKey: sql<string | null>`(SELECT storage_key FROM listing_images WHERE listing_id = ${listings.id} ORDER BY position LIMIT 1)`,
    vertical: listings.vertical,
  }).from(savedListings).innerJoin(listings, eq(savedListings.listingId, listings.id)).innerJoin(cities, eq(listings.cityId, cities.id))
    .where(and(eq(savedListings.userId, user.id), eq(listings.status, "active"))).orderBy(desc(savedListings.createdAt));
  return <main className="mx-auto w-full max-w-7xl px-4 py-8"><h1 className="text-2xl font-bold text-slate-950">Saved ads</h1><p className="mb-6 mt-1 text-sm text-slate-500">Your active favourites across cars, bikes and parts.</p>{rows.length ? <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map(row => <ListingCard key={row.id} row={row} vertical={row.vertical} initiallySaved />)}</ul> : <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-600">No saved ads yet. Tap Save on any listing.</div>}</main>;
}
