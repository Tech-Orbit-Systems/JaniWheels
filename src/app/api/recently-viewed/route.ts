import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { listings, listingImages } from "@/db/schema/listings";
import { cities } from "@/db/schema/geo";
import { makes, models } from "@/db/schema/taxonomy";
import { dealers, users } from "@/db/schema/users";
import { parseRecentlyViewedQuery } from "@/lib/listings/recently-viewed";
import { publicListingEligibility } from "@/lib/listings/public-eligibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ids = parseRecentlyViewedQuery(new URL(request.url).searchParams.get("ids"));
  if (!ids.length) {
    return NextResponse.json({ rows: [] }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const primaryImage = db.$with("recent_primary_image").as(
    db
      .select({
        listingId: listingImages.listingId,
        storageKey: sql<string>`MIN(${listingImages.storageKey})`.as("storage_key"),
      })
      .from(listingImages)
      .where(eq(listingImages.position, 0))
      .groupBy(listingImages.listingId),
  );

  const rows = await db
    .with(primaryImage)
    .select({
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
      primaryImageKey: sql<string | null>`${primaryImage.storageKey}`,
      sellerType: sql<string>`${users.type}::text`,
      dealerName: dealers.businessName,
      dealerVerifiedAt: dealers.verifiedAt,
    })
    .from(listings)
    .innerJoin(cities, eq(listings.cityId, cities.id))
    .innerJoin(users, eq(listings.sellerId, users.id))
    .leftJoin(dealers, eq(listings.dealerId, dealers.id))
    .leftJoin(makes, eq(listings.makeId, makes.id))
    .leftJoin(models, eq(listings.modelId, models.id))
    .leftJoin(primaryImage, eq(primaryImage.listingId, listings.id))
    .where(and(publicListingEligibility(), inArray(listings.id, ids)));

  const position = new Map(ids.map((id, index) => [id, index]));
  rows.sort((a, b) => (position.get(a.id) ?? ids.length) - (position.get(b.id) ?? ids.length));

  return NextResponse.json(
    { rows },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
