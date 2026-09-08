import { and, eq, ne, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import {
  listings,
  carDetails,
  bikeDetails,
  partDetails,
  listingImages,
  listingFeatures,
  listingCustomFeatures,
} from "@/db/schema/listings";
import {
  makes,
  models,
  variants,
  features,
  partCategories,
} from "@/db/schema/taxonomy";
import { cities, areas } from "@/db/schema/geo";
import { users, dealers } from "@/db/schema/users";
import type { Vertical } from "@/lib/seo/facets";

/**
 * Everything a detail page needs, in three queries rather than a dozen.
 *
 * One query serves all three verticals by left-joining each detail table;
 * the irrelevant ones come back null. That is cheaper than it looks (the
 * joins are on indexed primary keys) and far cheaper to maintain than three
 * near-identical queries that drift apart.
 *
 * Wrapped in `cache` because generateMetadata and the page body both call it.
 */
export const getListingDetail = cache(
  async (id: number, vertical: Vertical) => {
    const [row] = await db
      .select({
        id: listings.id,
        vertical: listings.vertical,
        slug: listings.slug,
        title: listings.title,
        description: listings.description,
        pricePkr: listings.pricePkr,
        isNegotiable: listings.isNegotiable,
        status: listings.status,
        sellerDeletedAt: listings.sellerDeletedAt,
        year: listings.year,
        mileageKm: listings.mileageKm,
        engineCc: listings.engineCc,
        transmission: sql<string | null>`${listings.transmission}::text`,
        fuel: sql<string | null>`${listings.fuel}::text`,
        bodyType: sql<string | null>`${listings.bodyType}::text`,
        assembly: sql<string | null>`${listings.assembly}::text`,
        viewCount: listings.viewCount,
        publishedAt: listings.publishedAt,
        updatedAt: listings.updatedAt,

        makeId: makes.id,
        makeName: sql<string | null>`COALESCE(${makes.name}, ${listings.customMakeName})`,
        makeSlug: makes.slug,
        modelId: models.id,
        modelName: sql<string | null>`COALESCE(${models.name}, ${listings.customModelName})`,
        modelSlug: models.slug,
        variantId: variants.id,
        variantName: sql<string | null>`COALESCE(${variants.name}, ${listings.customVariantName})`,

        cityId: cities.id,
        cityName: sql<string>`COALESCE(${listings.customCityName}, ${cities.name})`,
        citySlug: cities.slug,
        areaName: sql<string | null>`COALESCE(${areas.name}, ${listings.customAreaName})`,
        approximateLatitude: listings.approximateLatitude,
        approximateLongitude: listings.approximateLongitude,

        // car / bike shared extras, coalesced across the two detail tables
        color: sql<string | null>`COALESCE(${carDetails.color}, ${bikeDetails.color})`,
        isUnregistered: sql<boolean | null>`COALESCE(${carDetails.isUnregistered}, ${bikeDetails.isUnregistered})`,
        registeredCityName: sql<string | null>`reg_city.name`,
        ownerCount: carDetails.ownerCount,
        lastTokenPaidYear: carDetails.lastTokenPaidYear,
        hasAuctionSheet: carDetails.hasAuctionSheet,
        auctionGrade: carDetails.auctionGrade,

        bikeType: bikeDetails.bikeType,
        bikeCondition: bikeDetails.condition,
        bikeHasDocuments: bikeDetails.hasDocuments,
        bikeIgnitionType: bikeDetails.ignitionType,
        bikeEngineType: bikeDetails.engineType,
        bikeNumberOfGears: bikeDetails.numberOfGears,
        bikeMotorPowerWatts: bikeDetails.motorPowerWatts,
        bikeBatteryType: bikeDetails.batteryType,
        bikeBatteryVoltage: bikeDetails.batteryVoltage,
        bikeBatteryCapacityAh: bikeDetails.batteryCapacityAh,
        bikeClaimedRangeKm: bikeDetails.claimedRangeKm,
        bikeTopSpeedKph: bikeDetails.topSpeedKph,
        bikeChargingTimeMinutes: bikeDetails.chargingTimeMinutes,
        bikeBatteryHealthPercent: bikeDetails.batteryHealthPercent,
        bikeBatteryRemovable: bikeDetails.batteryRemovable,
        bikeChargerIncluded: bikeDetails.chargerIncluded,
        bikeBatteryWarrantyMonths: bikeDetails.batteryWarrantyMonths,

        // part extras
        partCondition: sql<string | null>`${partDetails.condition}::text`,
        partBrand: partDetails.brand,
        partNumber: partDetails.partNumber,
        partOemNumber: partDetails.oemNumber,
        partOrigin: partDetails.partOrigin,
        partPriceUnit: partDetails.priceUnit,
        partCompatibleYearFrom: partDetails.compatibleYearFrom,
        partCompatibleYearTo: partDetails.compatibleYearTo,
        partPosition: partDetails.position,
        partDeliveryOption: partDetails.deliveryOption,
        partWarrantyMonths: partDetails.warrantyMonths,
        partStockQty: partDetails.stockQty,
        partCategoryName: sql<string | null>`COALESCE(${partDetails.customCategoryName}, ${partCategories.name})`,
        partCategorySlug: partCategories.slug,
        compatibleMakeName: sql<string | null>`COALESCE(part_make.name, ${partDetails.customCompatibleMakeName})`,
        compatibleModelName: sql<string | null>`COALESCE(part_model.name, ${partDetails.customCompatibleModelName})`,

        sellerId: users.id,
        sellerName: users.name,
        sellerPhone: users.phone,
        sellerSince: users.createdAt,
        dealerId: dealers.id,
        dealerName: dealers.businessName,
        dealerSlug: dealers.slug,
      })
      .from(listings)
      .innerJoin(cities, eq(listings.cityId, cities.id))
      .innerJoin(users, eq(listings.sellerId, users.id))
      .leftJoin(makes, eq(listings.makeId, makes.id))
      .leftJoin(models, eq(listings.modelId, models.id))
      .leftJoin(variants, eq(listings.variantId, variants.id))
      .leftJoin(areas, eq(listings.areaId, areas.id))
      .leftJoin(carDetails, eq(carDetails.listingId, listings.id))
      .leftJoin(bikeDetails, eq(bikeDetails.listingId, listings.id))
      .leftJoin(partDetails, eq(partDetails.listingId, listings.id))
      .leftJoin(partCategories, eq(partDetails.categoryId, partCategories.id))
      .leftJoin(sql`${makes} AS part_make`, sql`part_make.id = ${partDetails.compatibleMakeId}`)
      .leftJoin(sql`${models} AS part_model`, sql`part_model.id = ${partDetails.compatibleModelId}`)
      .leftJoin(dealers, eq(listings.dealerId, dealers.id))
      .leftJoin(
        sql`${cities} AS reg_city`,
        sql`reg_city.id = COALESCE(${carDetails.registeredCityId}, ${bikeDetails.registeredCityId})`,
      )
      .where(and(eq(listings.id, id), eq(listings.vertical, vertical)))
      .limit(1);

    if (!row || row.sellerDeletedAt) return null;

    const [images, featureRows, customFeatureRows] = await Promise.all([
      db
        .select({ key: listingImages.storageKey, position: listingImages.position })
        .from(listingImages)
        .where(eq(listingImages.listingId, id))
        .orderBy(listingImages.position),
      db
        .select({
          name: features.name,
          slug: features.slug,
          groupName: features.groupName,
        })
        .from(listingFeatures)
        .innerJoin(features, eq(listingFeatures.featureId, features.id))
        .where(eq(listingFeatures.listingId, id)),
      db
        .select({ name: listingCustomFeatures.name })
        .from(listingCustomFeatures)
        .where(eq(listingCustomFeatures.listingId, id)),
    ]);

    return {
      ...row,
      images,
      features: [
        ...featureRows,
        ...customFeatureRows.map((feature) => ({ ...feature, slug: null, groupName: "other" })),
      ],
    };
  },
);

export type ListingDetailRow = NonNullable<
  Awaited<ReturnType<typeof getListingDetail>>
>;

/** Back-compat helper for the car route. */
export const getCarListing = (id: number) => getListingDetail(id, "car");

/**
 * "Similar ads" — the cheapest retention mechanism on a detail page, and the
 * reason a bounced buyer stays on the site instead of going back to Google.
 */
export const getSimilarListings = cache(
  async (listing: {
    id: number;
    vertical: Vertical;
    modelId: number | null;
    cityId: number;
    pricePkr: number;
  }) => {
    if (!listing.modelId) return [];

    return db
      .select({
        id: listings.id,
        slug: listings.slug,
        title: listings.title,
        pricePkr: listings.pricePkr,
        year: listings.year,
        mileageKm: listings.mileageKm,
        cityName: cities.name,
        primaryImageKey: sql<string | null>`(
          SELECT storage_key FROM listing_images
          WHERE listing_id = ${listings.id}
          ORDER BY position LIMIT 1
        )`,
      })
      .from(listings)
      .innerJoin(cities, eq(listings.cityId, cities.id))
      .where(
        and(
          eq(listings.status, "active"),
          eq(listings.modelId, listing.modelId),
          ne(listings.id, listing.id),
        ),
      )
      // Same city first, then closest in price — someone looking at a 48-lac
      // Civic is not in the market for an 18-lac one.
      .orderBy(
        sql`(${listings.cityId} = ${listing.cityId}) DESC`,
        sql`ABS(${listings.pricePkr} - ${listing.pricePkr})`,
      )
      .limit(6);
  },
);

/** Fire-and-forget view counter. Never blocks the render. */
export async function incrementViewCount(id: number): Promise<void> {
  await db
    .update(listings)
    .set({ viewCount: sql`${listings.viewCount} + 1` })
    .where(eq(listings.id, id));
}
