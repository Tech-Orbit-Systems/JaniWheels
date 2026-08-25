import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { areas, cities } from "@/db/schema/geo";
import { bikeDetails, carDetails, listingCustomFeatures, listingFeatures, listingImages, listings, partDetails } from "@/db/schema/listings";
import { features, makes, models, partCategories, variants } from "@/db/schema/taxonomy";
import { getCurrentUser } from "@/lib/auth/session";
import { ListingEditForm } from "./ListingEditForm";

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();

  const [listing] = await db.select({
    id: listings.id, sellerId: listings.sellerId, vertical: listings.vertical,
    status: listings.status, sellerDeletedAt: listings.sellerDeletedAt,
    title: listings.title, description: listings.description, pricePkr: listings.pricePkr,
    isNegotiable: listings.isNegotiable, cityId: listings.cityId, areaId: listings.areaId,
    customCityName: listings.customCityName, customAreaName: listings.customAreaName,
    makeId: listings.makeId, modelId: listings.modelId, variantId: listings.variantId,
    customMakeName: listings.customMakeName, customModelName: listings.customModelName,
    customVariantName: listings.customVariantName, year: listings.year,
    mileageKm: listings.mileageKm, assembly: listings.assembly,
    registeredCityId: carDetails.registeredCityId, carIsUnregistered: carDetails.isUnregistered,
    carColor: carDetails.color, ownerCount: carDetails.ownerCount,
    lastTokenPaidYear: carDetails.lastTokenPaidYear, hasAuctionSheet: carDetails.hasAuctionSheet,
    auctionGrade: carDetails.auctionGrade,
    bikeRegisteredCityId: bikeDetails.registeredCityId, bikeIsUnregistered: bikeDetails.isUnregistered,
    bikeColor: bikeDetails.color, hasDocuments: bikeDetails.hasDocuments, bikeType: bikeDetails.bikeType,
    bikeCondition: bikeDetails.condition, ignitionType: bikeDetails.ignitionType,
    engineType: bikeDetails.engineType, numberOfGears: bikeDetails.numberOfGears,
    motorPowerWatts: bikeDetails.motorPowerWatts, batteryType: bikeDetails.batteryType,
    batteryVoltage: bikeDetails.batteryVoltage, batteryCapacityAh: bikeDetails.batteryCapacityAh,
    claimedRangeKm: bikeDetails.claimedRangeKm, topSpeedKph: bikeDetails.topSpeedKph,
    chargingTimeMinutes: bikeDetails.chargingTimeMinutes, batteryHealthPercent: bikeDetails.batteryHealthPercent,
    batteryRemovable: bikeDetails.batteryRemovable, chargerIncluded: bikeDetails.chargerIncluded,
    batteryWarrantyMonths: bikeDetails.batteryWarrantyMonths,
    categoryId: partDetails.categoryId, partCondition: partDetails.condition,
    partBrand: partDetails.brand, customCategoryName: partDetails.customCategoryName,
    partNumber: partDetails.partNumber, oemNumber: partDetails.oemNumber,
    partOrigin: partDetails.partOrigin, priceUnit: partDetails.priceUnit,
    compatibleMakeId: partDetails.compatibleMakeId, compatibleModelId: partDetails.compatibleModelId,
    customCompatibleMakeName: partDetails.customCompatibleMakeName,
    customCompatibleModelName: partDetails.customCompatibleModelName,
    compatibleYearFrom: partDetails.compatibleYearFrom, compatibleYearTo: partDetails.compatibleYearTo,
    partPosition: partDetails.position, deliveryOption: partDetails.deliveryOption,
    warrantyMonths: partDetails.warrantyMonths, stockQty: partDetails.stockQty,
  }).from(listings)
    .leftJoin(carDetails, eq(carDetails.listingId, listings.id))
    .leftJoin(bikeDetails, eq(bikeDetails.listingId, listings.id))
    .leftJoin(partDetails, eq(partDetails.listingId, listings.id))
    .where(eq(listings.id, id)).limit(1);

  if (!listing || listing.sellerId !== user.id || listing.sellerDeletedAt || listing.status === "removed") notFound();

  const [cityRows, areaRows, imageRows, featureRows, customFeatureRows, makeRows, categoryRows] = await Promise.all([
    db.select({ id: cities.id, name: cities.name }).from(cities).orderBy(desc(cities.popularity), asc(cities.name)),
    db.select({ id: areas.id, name: areas.name }).from(areas).where(eq(areas.cityId, listing.cityId)).orderBy(asc(areas.name)),
    db.select({ key: listingImages.storageKey }).from(listingImages).where(eq(listingImages.listingId, id)).orderBy(listingImages.position),
    listing.vertical === "part" ? Promise.resolve([]) : db.select({ id: features.id, name: features.name, groupName: features.groupName })
      .from(features).where(eq(features.vertical, listing.vertical)).orderBy(asc(features.groupName), asc(features.name)),
    db.select({ name: listingCustomFeatures.name }).from(listingCustomFeatures).where(eq(listingCustomFeatures.listingId, id)),
    db.select({ id: makes.id, name: makes.name, vertical: makes.vertical }).from(makes)
      .where(and(inArray(makes.vertical, listing.vertical === "part" ? ["car", "bike"] : [listing.vertical]), eq(makes.isActive, true)))
      .orderBy(desc(makes.popularity), asc(makes.name)),
    listing.vertical === "part" ? db.select({ id: partCategories.id, name: partCategories.name, parentId: partCategories.parentId })
      .from(partCategories).orderBy(asc(partCategories.parentId), desc(partCategories.popularity), asc(partCategories.name)) : Promise.resolve([]),
  ]);

  const [initialModels, initialVariants, compatibleModels, selectedFeatures] = await Promise.all([
    listing.makeId ? db.select({ id: models.id, name: models.name }).from(models).where(and(eq(models.makeId, listing.makeId), eq(models.isActive, true))).orderBy(desc(models.popularity), asc(models.name)) : Promise.resolve([]),
    listing.modelId ? db.select({ id: variants.id, name: variants.name }).from(variants).where(and(eq(variants.modelId, listing.modelId), eq(variants.isActive, true))).orderBy(asc(variants.name)) : Promise.resolve([]),
    listing.compatibleMakeId ? db.select({ id: models.id, name: models.name }).from(models).where(and(eq(models.makeId, listing.compatibleMakeId), eq(models.isActive, true))).orderBy(desc(models.popularity), asc(models.name)) : Promise.resolve([]),
    db.select({ id: listingFeatures.featureId }).from(listingFeatures).where(eq(listingFeatures.listingId, id)),
  ]);

  const byCategoryId = new Map(categoryRows.map((category) => [category.id, category]));
  const parents = new Set(categoryRows.map((category) => category.parentId).filter((value): value is number => value !== null));
  const categories = categoryRows.filter((category) => !parents.has(category.id)).map((category) => {
    const names = [category.name]; let parentId = category.parentId;
    while (parentId) { const parent = byCategoryId.get(parentId); if (!parent) break; names.unshift(parent.name); parentId = parent.parentId; }
    return { id: category.id, name: names.join(" › ") };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return <main className="mx-auto w-full max-w-5xl px-4 py-8">
    <Link href="/dashboard" className="text-sm font-bold text-blue-700 hover:underline">← My ads</Link>
    <div className="mt-4 mb-7"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-700">Manage advertisement</p><h1 className="mt-1 text-3xl font-black text-slate-950">Edit {listing.title}</h1><p className="mt-2 text-sm text-slate-600">Changes to a rejected ad will resubmit it for review. Other ad statuses remain unchanged.</p></div>
    <ListingEditForm listing={listing} cities={cityRows} initialAreas={areaRows} images={imageRows.map((image) => image.key)}
      makes={makeRows.map((make) => ({ id: make.id, name: `${make.name}${listing.vertical === "part" ? ` (${make.vertical === "bike" ? "Bike" : "Car"})` : ""}` }))}
      initialModels={initialModels} initialVariants={initialVariants} compatibleModels={compatibleModels}
      categories={categories} features={featureRows} selectedFeatureIds={selectedFeatures.map((feature) => feature.id)}
      customFeatures={customFeatureRows.map((feature) => feature.name)} />
  </main>;
}
