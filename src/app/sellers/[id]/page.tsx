import type { Metadata } from "next";
import Image from "@/components/StoredImage";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema/geo";
import { listingImages, listings } from "@/db/schema/listings";
import { makes, models } from "@/db/schema/taxonomy";
import { users } from "@/db/schema/users";
import { ListingCard } from "@/components/ListingCard";
import { PAGE_SIZE } from "@/lib/listings/search";
import { imageDeliveryUrl } from "@/lib/images/url";

export const metadata: Metadata = {
  title: "Seller profile | JaniWheels",
  robots: { index: false, follow: true },
};

export default async function SellerProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  const { id: rawId } = await params;
  const { page: rawPage } = await searchParams;
  const sellerId = Number(rawId);
  if (!Number.isInteger(sellerId) || sellerId <= 0) notFound();
  const page = Math.max(1, Number(rawPage ?? 1) || 1);

  const [seller] = await db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl, createdAt: users.createdAt, type: users.type })
    .from(users)
    .where(and(eq(users.id, sellerId), eq(users.type, "individual"), eq(users.isBanned, false)))
    .limit(1);
  if (!seller) notFound();

  const where = and(eq(listings.sellerId, seller.id), eq(listings.status, "active"));
  const [rows, [{ count }]] = await Promise.all([
    db.select({
      id: listings.id,
      vertical: listings.vertical,
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
      publishedAt: listings.publishedAt,
      primaryImageKey: sql<string | null>`(SELECT storage_key FROM ${listingImages} WHERE listing_id = ${listings.id} ORDER BY position LIMIT 1)`,
      sellerType: sql<string>`${users.type}::text`,
    }).from(listings)
      .innerJoin(cities, eq(listings.cityId, cities.id))
      .innerJoin(users, eq(listings.sellerId, users.id))
      .leftJoin(makes, eq(listings.makeId, makes.id))
      .leftJoin(models, eq(listings.modelId, models.id))
      .where(where)
      .orderBy(desc(listings.publishedAt), desc(listings.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(listings).where(where),
  ]);
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
  if (page > pageCount && count > 0) notFound();
  const displayName = seller.name ?? "Private seller";

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      <section className="mb-6 flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-full bg-slate-100">
          {seller.avatarUrl ? <Image src={imageDeliveryUrl(seller.avatarUrl, 160)} alt={`${displayName} profile`} fill sizes="80px" className="object-cover" /> : <span className="flex size-full items-center justify-center text-2xl font-bold text-slate-400">{displayName.charAt(0).toUpperCase()}</span>}
        </div>
        <div><h1 className="text-2xl font-semibold text-slate-900">{displayName}</h1><p className="text-sm text-slate-500">Private seller · member since {seller.createdAt.getFullYear()}</p></div>
      </section>
      <h2 className="mb-3 text-lg font-semibold text-slate-900">{count} active ad{count === 1 ? "" : "s"}</h2>
      {rows.length ? <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map((row) => <ListingCard key={row.id} row={row} vertical={row.vertical} />)}</ul> : <p className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600">This seller has no live ads right now.</p>}
      {pageCount > 1 && <nav aria-label="Seller listings pages" className="mt-8 flex justify-center gap-3">{page > 1 && <Link href={`/sellers/${seller.id}?page=${page - 1}`} className="rounded border border-slate-300 px-4 py-2 text-sm">Previous</Link>}<span className="px-2 py-2 text-sm text-slate-500">Page {page} of {pageCount}</span>{page < pageCount && <Link href={`/sellers/${seller.id}?page=${page + 1}`} className="rounded border border-slate-300 px-4 py-2 text-sm">Next</Link>}</nav>}
    </main>
  );
}
