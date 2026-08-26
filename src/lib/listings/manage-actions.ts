"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  bikeDetails,
  carDetails,
  listingCustomFeatures,
  listingFeatures,
  listingImages,
  listings,
  partDetails,
  pendingUploads,
} from "@/db/schema/listings";
import { areas, cities } from "@/db/schema/geo";
import { makes, models, partCategories, variants } from "@/db/schema/taxonomy";
import { getCurrentUser } from "@/lib/auth/session";
import { moderationLog } from "@/db/schema/trust";
import { claimUploadedImages, UploadOwnershipError } from "@/lib/images/ownership";
import { removeStoredImage } from "@/lib/images/storage";
import { buildListingSlug, buildListingPath } from "./slug";
import {
  bikeListingSchema,
  carListingSchema,
  partListingSchema,
  sanitizeDescription,
} from "./validation";
import type { SellState } from "./sell-actions";

function num(value: FormDataEntryValue | null): number | undefined {
  if (value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function text(value: FormDataEntryValue | null): string | undefined {
  const parsed = typeof value === "string" ? value.trim() : "";
  return parsed || undefined;
}

function customFeatures(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function fieldErrors(error: { issues: { path: PropertyKey[]; message: string }[] }): SellState {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fields[key] ??= issue.message;
  }
  return { error: "Please fix the highlighted fields.", fieldErrors: fields };
}

async function ownedListing(userId: number, listingId: number) {
  const [row] = await db.select({
    id: listings.id,
    sellerId: listings.sellerId,
    vertical: listings.vertical,
    status: listings.status,
    sellerDeletedAt: listings.sellerDeletedAt,
  }).from(listings).where(eq(listings.id, listingId)).limit(1);
  return row?.sellerId === userId && !row.sellerDeletedAt ? row : null;
}

async function validateLocation(cityId: number, areaId?: number) {
  const [city] = await db.select({ id: cities.id, name: cities.name })
    .from(cities).where(eq(cities.id, cityId)).limit(1);
  if (!city) return null;
  if (areaId) {
    const [area] = await db.select({ id: areas.id }).from(areas)
      .where(and(eq(areas.id, areaId), eq(areas.cityId, cityId))).limit(1);
    if (!area) return null;
  }
  return city;
}

type ParsedEdit =
  | { vertical: "car"; data: ReturnType<typeof carListingSchema.parse> }
  | { vertical: "bike"; data: ReturnType<typeof bikeListingSchema.parse> }
  | { vertical: "part"; data: ReturnType<typeof partListingSchema.parse> };

function parseEdit(vertical: "car" | "bike" | "part", formData: FormData): ParsedEdit | SellState {
  const common = {
    cityId: num(formData.get("cityId")),
    areaId: num(formData.get("areaId")),
    customCityName: text(formData.get("customCityName")),
    customAreaName: text(formData.get("customAreaName")),
    pricePkr: num(formData.get("pricePkr")),
    isNegotiable: formData.get("isNegotiable") === "on",
    description: text(formData.get("description")),
    imageKeys: formData.getAll("imageKeys").map(String).filter(Boolean),
  };

  if (vertical === "car") {
    const parsed = carListingSchema.safeParse({
      ...common,
      variantId: num(formData.get("variantId")),
      customMakeName: text(formData.get("customMakeName")),
      customModelName: text(formData.get("customModelName")),
      customVariantName: text(formData.get("customVariantName")),
      year: num(formData.get("year")),
      mileageKm: num(formData.get("mileageKm")),
      registeredCityId: num(formData.get("registeredCityId")),
      isUnregistered: formData.get("isUnregistered") === "on",
      assembly: formData.get("assembly"),
      color: text(formData.get("color")),
      ownerCount: num(formData.get("ownerCount")),
      lastTokenPaidYear: num(formData.get("lastTokenPaidYear")),
      hasAuctionSheet: formData.get("hasAuctionSheet") === "on",
      auctionGrade: text(formData.get("auctionGrade")),
      featureIds: formData.getAll("featureIds").map(Number).filter(Number.isFinite),
      customFeatureNames: customFeatures(formData.get("customFeatureNames")),
    });
    return parsed.success ? { vertical, data: parsed.data } : fieldErrors(parsed.error);
  }

  if (vertical === "bike") {
    const bikeType = String(formData.get("bikeType") ?? "motorcycle");
    const parsed = bikeListingSchema.safeParse({
      ...common,
      variantId: num(formData.get("variantId")),
      customMakeName: text(formData.get("customMakeName")),
      customModelName: text(formData.get("customModelName")),
      customVariantName: text(formData.get("customVariantName")),
      bikeType,
      condition: formData.get("condition"),
      isElectric: bikeType.startsWith("electric-"),
      registeredCityId: num(formData.get("registeredCityId")),
      isUnregistered: formData.get("isUnregistered") === "on",
      year: num(formData.get("year")),
      mileageKm: num(formData.get("mileageKm")),
      assembly: formData.get("assembly"),
      color: text(formData.get("color")),
      hasDocuments: formData.get("hasDocuments") === "on",
      ignitionType: text(formData.get("ignitionType")),
      engineType: text(formData.get("engineType")),
      numberOfGears: num(formData.get("numberOfGears")),
      motorPowerWatts: num(formData.get("motorPowerWatts")),
      batteryType: text(formData.get("batteryType")),
      batteryVoltage: num(formData.get("batteryVoltage")),
      batteryCapacityAh: num(formData.get("batteryCapacityAh")),
      claimedRangeKm: num(formData.get("claimedRangeKm")),
      topSpeedKph: num(formData.get("topSpeedKph")),
      chargingTimeMinutes: num(formData.get("chargingTimeMinutes")),
      batteryHealthPercent: num(formData.get("batteryHealthPercent")),
      batteryRemovable: formData.get("batteryRemovable") === "on",
      chargerIncluded: formData.get("chargerIncluded") === "on",
      batteryWarrantyMonths: num(formData.get("batteryWarrantyMonths")),
      featureIds: formData.getAll("featureIds").map(Number).filter(Number.isFinite),
      customFeatureNames: customFeatures(formData.get("customFeatureNames")),
    });
    return parsed.success ? { vertical, data: parsed.data } : fieldErrors(parsed.error);
  }

  const parsed = partListingSchema.safeParse({
    ...common,
    categoryId: num(formData.get("categoryId")),
    customCategoryName: text(formData.get("customCategoryName")),
    condition: formData.get("condition"),
    brand: text(formData.get("brand")),
    partNumber: text(formData.get("partNumber")),
    oemNumber: text(formData.get("oemNumber")),
    partOrigin: formData.get("partOrigin"),
    priceUnit: formData.get("priceUnit"),
    compatibleMakeId: num(formData.get("compatibleMakeId")),
    compatibleModelId: num(formData.get("compatibleModelId")),
    customCompatibleMakeName: text(formData.get("customCompatibleMakeName")),
    customCompatibleModelName: text(formData.get("customCompatibleModelName")),
    compatibleYearFrom: num(formData.get("compatibleYearFrom")),
    compatibleYearTo: num(formData.get("compatibleYearTo")),
    position: text(formData.get("position")),
    deliveryOption: formData.get("deliveryOption"),
    warrantyMonths: num(formData.get("warrantyMonths")),
    stockQty: num(formData.get("stockQty")),
  });
  return parsed.success ? { vertical, data: parsed.data } : fieldErrors(parsed.error);
}

export async function updateListingAction(
  listingId: number,
  _previous: SellState,
  formData: FormData,
): Promise<SellState> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/dashboard/listings/${listingId}/edit`);
  const listing = user.isAdmin
    ? await db.select({ id: listings.id, sellerId: listings.sellerId, vertical: listings.vertical, status: listings.status, sellerDeletedAt: listings.sellerDeletedAt })
      .from(listings).where(eq(listings.id, listingId)).limit(1).then(([row]) => row?.sellerDeletedAt ? null : row)
    : await ownedListing(user.id, listingId);
  if (!listing || listing.status === "removed") return { error: "This ad cannot be edited." };

  const parsed = parseEdit(listing.vertical, formData);
  if (!("vertical" in parsed)) return parsed;
  const location = await validateLocation(parsed.data.cityId, parsed.data.areaId);
  if (!location) return { error: "Choose a valid city and area.", fieldErrors: { cityId: "Choose a valid city and area." } };

  let removedKeys: string[] = [];
  try {
    removedKeys = await db.transaction(async (tx) => {
      const [locked] = await tx.select({ sellerId: listings.sellerId, status: listings.status })
        .from(listings).where(eq(listings.id, listingId)).limit(1);
      const adminEdit = Boolean(user.isAdmin && locked?.sellerId !== user.id);
      if (!locked || (!adminEdit && locked.sellerId !== user.id) || locked.status === "removed") throw new Error("LISTING_UNAVAILABLE");

      const existing = await tx.select({ key: listingImages.storageKey })
        .from(listingImages).where(eq(listingImages.listingId, listingId));
      const existingKeys = new Set(existing.map((image) => image.key));
      const newKeys = parsed.data.imageKeys.filter((key) => !existingKeys.has(key));
      const removed = existing.map((image) => image.key).filter((key) => !parsed.data.imageKeys.includes(key));
      if (newKeys.length) await claimUploadedImages(tx, user.id, listingId, newKeys);

      const description = sanitizeDescription(parsed.data.description ?? "").text || null;
      const nextStatus = !adminEdit && locked.status === "rejected" ? "pending_review" : locked.status;

      if (parsed.vertical === "car") {
        const data = parsed.data;
        const [variant] = data.variantId ? await tx.select({
          id: variants.id, name: variants.name, engineCc: variants.engineCc,
          transmission: variants.transmission, fuel: variants.fuel,
          variantBodyType: variants.bodyType, modelId: models.id,
          modelName: models.name, modelBodyType: models.bodyType,
          makeId: makes.id, makeName: makes.name, vertical: makes.vertical,
        }).from(variants).innerJoin(models, eq(variants.modelId, models.id))
          .innerJoin(makes, eq(models.makeId, makes.id))
          .where(eq(variants.id, data.variantId)).limit(1) : [];
        if (variant && variant.vertical !== "car") throw new Error("INVALID_TAXONOMY");
        const makeName = variant?.makeName ?? data.customMakeName!;
        const modelName = variant?.modelName ?? data.customModelName!;
        const variantName = variant?.name ?? data.customVariantName;
        await tx.update(listings).set({
          title: [makeName, modelName, variantName, data.year].filter(Boolean).join(" "),
          slug: buildListingSlug({ makeName, modelName, variantName, year: data.year, cityName: data.customCityName ?? location.name }),
          description, pricePkr: data.pricePkr, isNegotiable: data.isNegotiable,
          cityId: data.cityId, areaId: data.areaId ?? null,
          customCityName: data.customCityName ?? null, customAreaName: data.customAreaName ?? null,
          makeId: variant?.makeId ?? null, modelId: variant?.modelId ?? null,
          variantId: variant?.id ?? null, customMakeName: variant ? null : makeName,
          customModelName: variant ? null : modelName, customVariantName: variant ? null : (variantName ?? null),
          year: data.year, mileageKm: data.mileageKm, transmission: variant?.transmission ?? null,
          fuel: variant?.fuel ?? null, bodyType: variant?.variantBodyType ?? variant?.modelBodyType ?? null,
          engineCc: variant?.engineCc ?? null, assembly: data.assembly, status: nextStatus,
          photoCount: data.imageKeys.length, updatedAt: new Date(),
        }).where(eq(listings.id, listingId));
        await tx.update(carDetails).set({
          registeredCityId: data.registeredCityId ?? null, isUnregistered: data.isUnregistered,
          color: data.color ?? null, ownerCount: data.ownerCount ?? null,
          lastTokenPaidYear: data.lastTokenPaidYear ?? null, hasAuctionSheet: data.hasAuctionSheet,
          auctionGrade: data.auctionGrade ?? null,
        }).where(eq(carDetails.listingId, listingId));
        await replaceFeatures(tx, listingId, data.featureIds, data.customFeatureNames);
      } else if (parsed.vertical === "bike") {
        const data = parsed.data;
        const [variant] = data.variantId ? await tx.select({
          id: variants.id, name: variants.name, engineCc: variants.engineCc,
          transmission: variants.transmission, fuel: variants.fuel,
          modelId: models.id, modelName: models.name,
          makeId: makes.id, makeName: makes.name, vertical: makes.vertical,
        }).from(variants).innerJoin(models, eq(variants.modelId, models.id))
          .innerJoin(makes, eq(models.makeId, makes.id))
          .where(eq(variants.id, data.variantId)).limit(1) : [];
        if (variant && variant.vertical !== "bike") throw new Error("INVALID_TAXONOMY");
        const makeName = variant?.makeName ?? data.customMakeName!;
        const modelName = variant?.modelName ?? data.customModelName!;
        const variantName = variant?.name ?? data.customVariantName;
        await tx.update(listings).set({
          title: [makeName, modelName, variantName, data.year].filter(Boolean).join(" "),
          slug: buildListingSlug({ makeName, modelName, variantName, year: data.year, cityName: data.customCityName ?? location.name }),
          description, pricePkr: data.pricePkr, isNegotiable: data.isNegotiable,
          cityId: data.cityId, areaId: data.areaId ?? null,
          customCityName: data.customCityName ?? null, customAreaName: data.customAreaName ?? null,
          makeId: variant?.makeId ?? null, modelId: variant?.modelId ?? null,
          variantId: variant?.id ?? null, customMakeName: variant ? null : makeName,
          customModelName: variant ? null : modelName, customVariantName: variant ? null : (variantName ?? null),
          year: data.year, mileageKm: data.mileageKm,
          transmission: variant?.transmission ?? (data.isElectric ? "automatic" : null),
          fuel: variant?.fuel ?? (data.isElectric ? "electric" : "petrol"),
          engineCc: variant?.engineCc ?? null, assembly: data.assembly, status: nextStatus,
          photoCount: data.imageKeys.length, updatedAt: new Date(),
        }).where(eq(listings.id, listingId));
        await tx.update(bikeDetails).set({
          registeredCityId: data.registeredCityId ?? null, isUnregistered: data.isUnregistered,
          color: data.color ?? null, hasDocuments: data.hasDocuments, bikeType: data.bikeType,
          condition: data.condition, ignitionType: data.isElectric ? null : (data.ignitionType ?? null),
          engineType: data.isElectric ? null : (data.engineType ?? null),
          numberOfGears: data.isElectric ? null : (data.numberOfGears ?? null),
          motorPowerWatts: data.isElectric ? (data.motorPowerWatts ?? null) : null,
          batteryType: data.isElectric ? (data.batteryType ?? null) : null,
          batteryVoltage: data.isElectric ? (data.batteryVoltage ?? null) : null,
          batteryCapacityAh: data.isElectric ? (data.batteryCapacityAh ?? null) : null,
          claimedRangeKm: data.isElectric ? (data.claimedRangeKm ?? null) : null,
          topSpeedKph: data.isElectric ? (data.topSpeedKph ?? null) : null,
          chargingTimeMinutes: data.isElectric ? (data.chargingTimeMinutes ?? null) : null,
          batteryHealthPercent: data.isElectric ? (data.batteryHealthPercent ?? null) : null,
          batteryRemovable: data.isElectric ? (data.batteryRemovable ?? false) : null,
          chargerIncluded: data.isElectric ? (data.chargerIncluded ?? false) : null,
          batteryWarrantyMonths: data.isElectric ? (data.batteryWarrantyMonths ?? null) : null,
        }).where(eq(bikeDetails.listingId, listingId));
        await replaceFeatures(tx, listingId, data.featureIds, data.customFeatureNames);
      } else {
        const data = parsed.data;
        const [category] = await tx.select({ id: partCategories.id, name: partCategories.name })
          .from(partCategories).where(eq(partCategories.id, data.categoryId)).limit(1);
        if (!category) throw new Error("INVALID_TAXONOMY");
        const [child] = await tx.select({ id: partCategories.id }).from(partCategories)
          .where(eq(partCategories.parentId, category.id)).limit(1);
        if (child) throw new Error("INVALID_TAXONOMY");
        if (data.compatibleModelId && data.compatibleMakeId) {
          const [model] = await tx.select({ id: models.id }).from(models)
            .where(and(eq(models.id, data.compatibleModelId), eq(models.makeId, data.compatibleMakeId))).limit(1);
          if (!model) throw new Error("INVALID_TAXONOMY");
        }
        const categoryName = data.customCategoryName ?? category.name;
        await tx.update(listings).set({
          title: [data.brand, categoryName, data.partNumber].filter(Boolean).join(" "),
          slug: buildListingSlug({ makeName: data.brand, modelName: categoryName, variantName: data.partNumber, cityName: data.customCityName ?? location.name }),
          description, pricePkr: data.pricePkr, isNegotiable: data.isNegotiable,
          cityId: data.cityId, areaId: data.areaId ?? null,
          customCityName: data.customCityName ?? null, customAreaName: data.customAreaName ?? null,
          status: nextStatus, photoCount: data.imageKeys.length, updatedAt: new Date(),
        }).where(eq(listings.id, listingId));
        await tx.update(partDetails).set({
          categoryId: data.categoryId, condition: data.condition, brand: data.brand,
          customCategoryName: data.customCategoryName ?? null, partNumber: data.partNumber ?? null,
          oemNumber: data.oemNumber ?? null, partOrigin: data.partOrigin, priceUnit: data.priceUnit,
          compatibleMakeId: data.compatibleMakeId ?? null, compatibleModelId: data.compatibleModelId ?? null,
          customCompatibleMakeName: data.customCompatibleMakeName ?? null,
          customCompatibleModelName: data.customCompatibleModelName ?? null,
          compatibleYearFrom: data.compatibleYearFrom ?? null, compatibleYearTo: data.compatibleYearTo ?? null,
          position: data.position ?? null, deliveryOption: data.deliveryOption,
          warrantyMonths: data.warrantyMonths ?? null, stockQty: data.stockQty,
        }).where(eq(partDetails.listingId, listingId));
      }

      await tx.delete(listingImages).where(eq(listingImages.listingId, listingId));
      await tx.insert(listingImages).values(parsed.data.imageKeys.map((key, position) => ({ listingId, storageKey: key, position })));
      if (adminEdit) await tx.insert(moderationLog).values({
        listingId,
        userId: locked.sellerId,
        moderatorId: user.id,
        action: "edit",
        reason: "Administrator edited listing details.",
        isAutomated: false,
        metadata: { preservedStatus: locked.status },
      });
      if (removed.length) await tx.delete(pendingUploads).where(and(
        eq(pendingUploads.listingId, listingId),
        inArray(pendingUploads.storageKey, removed),
      ));
      return removed;
    });
  } catch (error) {
    if (error instanceof UploadOwnershipError) return { error: error.message, fieldErrors: { imageKeys: error.message } };
    if (error instanceof Error && error.message === "INVALID_TAXONOMY") return { error: "Choose valid category and vehicle options." };
    if (error instanceof Error && error.message === "LISTING_UNAVAILABLE") return { error: "This ad can no longer be edited." };
    throw error;
  }

  await Promise.all(removedKeys.map((key) => removeStoredImage(key)));
  revalidatePath("/dashboard");
  revalidatePath(buildListingPath(listing.vertical, "updated", listingId));
  redirect(user.isAdmin && listing.sellerId !== user.id ? `/admin/listings?updated=${listingId}` : `/dashboard?updated=1`);
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function replaceFeatures(tx: Transaction, listingId: number, featureIds: number[], names: string[]) {
  await tx.delete(listingFeatures).where(eq(listingFeatures.listingId, listingId));
  await tx.delete(listingCustomFeatures).where(eq(listingCustomFeatures.listingId, listingId));
  const ids = [...new Set(featureIds)];
  if (ids.length) await tx.insert(listingFeatures).values(ids.map((featureId) => ({ listingId, featureId })));
  const custom = [...new Set(names.map((name) => name.trim()))];
  if (custom.length) await tx.insert(listingCustomFeatures).values(custom.map((name) => ({ listingId, name })));
}

export async function deleteListingAction(listingId: number): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  const listing = await ownedListing(user.id, listingId);
  if (!listing) return;

  const keys = await db.transaction(async (tx) => {
    const images = await tx.select({ key: listingImages.storageKey }).from(listingImages)
      .where(eq(listingImages.listingId, listingId));
    await tx.update(listings).set({
      status: "removed", sellerDeletedAt: new Date(), updatedAt: new Date(), photoCount: 0,
    }).where(and(eq(listings.id, listingId), eq(listings.sellerId, user.id)));
    await tx.delete(listingImages).where(eq(listingImages.listingId, listingId));
    await tx.delete(pendingUploads).where(eq(pendingUploads.listingId, listingId));
    return images.map((image) => image.key);
  });
  await Promise.all(keys.map((key) => removeStoredImage(key)));
  revalidatePath("/dashboard");
}

export async function reactivateListingAction(listingId: number): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  const listing = await ownedListing(user.id, listingId);
  if (!listing || (listing.status !== "sold" && listing.status !== "expired")) return;
  const now = new Date();
  await db.update(listings).set({
    status: "active", soldAt: null, publishedAt: now,
    expiresAt: new Date(now.getTime() + 30 * 86_400_000), updatedAt: now,
  }).where(and(eq(listings.id, listingId), eq(listings.sellerId, user.id)));
  revalidatePath("/dashboard");
}
