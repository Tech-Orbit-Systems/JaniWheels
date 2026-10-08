"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { carDetails, listings } from "@/db/schema/listings";
import { dealers } from "@/db/schema/users";
import { getCurrentUser } from "@/lib/auth/session";
import { requirePostingPhone } from "@/lib/auth/seller-readiness";
import { bikeListingSchema, carListingSchema, partListingSchema, sanitizeDescription } from "./validation";
import { ListingInputError, publishBikeListing, publishCarListing, publishPartListing } from "./publish";
import { buildListingPath } from "./slug";
import { UploadOwnershipError } from "@/lib/images/ownership";
import { listingEditHeld } from "./edit-protection";
import { assertListingQuota, ListingQuotaError, lockListingOwner } from "./quota";
import { ACCOUNT_LIMITS, allowAccountAction, allowPublicAction } from "@/lib/security/rate-limit";

export interface SellState {
  error?: string;
  fieldErrors?: Record<string, string>;
  notice?: string;
}

async function allowListingPublication(userId: number): Promise<boolean> {
  return allowPublicAction(
    "listing-publication", `user:${userId}`, await headers(),
    { max: 20, sourceMax: 200, windowMs: 24 * 60 * 60_000 },
  );
}

function num(v: FormDataEntryValue | null): number | undefined {
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function optionalText(v: FormDataEntryValue | null): string | undefined {
  const value = typeof v === "string" ? v.trim() : "";
  return value || undefined;
}

function customFeatures(v: FormDataEntryValue | null): string[] {
  if (typeof v !== "string") return [];
  return v.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

export async function createCarListingAction(
  _prev: SellState,
  formData: FormData,
): Promise<SellState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/sell");
  requirePostingPhone(user);

  const parsed = carListingSchema.safeParse({
    variantId: num(formData.get("variantId")),
    customMakeName: optionalText(formData.get("customMakeName")),
    customModelName: optionalText(formData.get("customModelName")),
    customVariantName: optionalText(formData.get("customVariantName")),
    cityId: num(formData.get("cityId")),
    areaId: num(formData.get("areaId")),
    customCityName: optionalText(formData.get("customCityName")),
    customAreaName: optionalText(formData.get("customAreaName")),
    exactLatitude: num(formData.get("exactLatitude")),
    exactLongitude: num(formData.get("exactLongitude")),
    year: num(formData.get("year")),
    pricePkr: num(formData.get("pricePkr")),
    mileageKm: num(formData.get("mileageKm")),
    registeredCityId: num(formData.get("registeredCityId")),
    isUnregistered: formData.get("isUnregistered") === "on",
    assembly: formData.get("assembly") ?? "local",
    color: (formData.get("color") as string) || undefined,
    ownerCount: num(formData.get("ownerCount")),
    lastTokenPaidYear: num(formData.get("lastTokenPaidYear")),
    hasAuctionSheet: formData.get("hasAuctionSheet") === "on",
    auctionGrade: optionalText(formData.get("auctionGrade")),
    isNegotiable: formData.get("isNegotiable") === "on",
    description: (formData.get("description") as string) || undefined,
    featureIds: formData
      .getAll("featureIds")
      .map((v) => Number(v))
      .filter(Number.isFinite),
    customFeatureNames: customFeatures(formData.get("customFeatureNames")),
    imageKeys: formData.getAll("imageKeys").map(String).filter(Boolean),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const [dealer] = await db
    .select({ id: dealers.id, verifiedAt: dealers.verifiedAt })
    .from(dealers)
    .where(eq(dealers.userId, user.id))
    .limit(1);

  if (!await allowListingPublication(user.id)) {
    return { error: "Too many ads posted today. Please try again tomorrow." };
  }
  let result;
  try {
    result = await publishCarListing(user.id, parsed.data, {
      dealerId: dealer?.id,
      publisher: dealer
        ? dealer.verifiedAt
          ? "verified_dealer"
          : "unverified_dealer"
        : "individual",
    });
  } catch (error) {
    if (error instanceof ListingQuotaError) return { error: error.message };
    if (error instanceof ListingInputError) return { error: "Please fix the highlighted fields.", fieldErrors: { [error.field]: error.message } };
    if (error instanceof UploadOwnershipError) {
      return { error: error.message, fieldErrors: { imageKeys: error.message } };
    }
    throw error;
  }

  revalidatePath("/used-cars");
  redirect(
    `${buildListingPath("car", result.slug, result.listingId)}?posted=1${
      result.strippedContact ? "&stripped=1" : ""
    }`,
  );
}

export async function createPartListingAction(
  _prev: SellState,
  formData: FormData,
): Promise<SellState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/sell/part");
  requirePostingPhone(user);
  const parsed = partListingSchema.safeParse({
    categoryId: num(formData.get("categoryId")),
    condition: formData.get("condition"),
    brand: (formData.get("brand") as string) || "",
    partNumber: (formData.get("partNumber") as string) || undefined,
    oemNumber: (formData.get("oemNumber") as string) || undefined,
    partOrigin: formData.get("partOrigin"),
    priceUnit: formData.get("priceUnit"),
    compatibleMakeId: num(formData.get("compatibleMakeId")),
    compatibleModelId: num(formData.get("compatibleModelId")),
    customCompatibleMakeName: optionalText(formData.get("customCompatibleMakeName")),
    customCompatibleModelName: optionalText(formData.get("customCompatibleModelName")),
    compatibleYearFrom: num(formData.get("compatibleYearFrom")),
    compatibleYearTo: num(formData.get("compatibleYearTo")),
    position: formData.get("position") || undefined,
    deliveryOption: formData.get("deliveryOption"),
    warrantyMonths: num(formData.get("warrantyMonths")),
    stockQty: num(formData.get("stockQty")),
    cityId: num(formData.get("cityId")),
    areaId: num(formData.get("areaId")),
    customCityName: optionalText(formData.get("customCityName")),
    customAreaName: optionalText(formData.get("customAreaName")),
    exactLatitude: num(formData.get("exactLatitude")),
    exactLongitude: num(formData.get("exactLongitude")),
    customCategoryName: optionalText(formData.get("customCategoryName")),
    pricePkr: num(formData.get("pricePkr")),
    isNegotiable: formData.get("isNegotiable") === "on",
    description: (formData.get("description") as string) || undefined,
    imageKeys: formData.getAll("imageKeys").map(String).filter(Boolean),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const [dealer] = await db.select({ id: dealers.id, verifiedAt: dealers.verifiedAt })
    .from(dealers).where(eq(dealers.userId, user.id)).limit(1);
  if (!await allowListingPublication(user.id)) {
    return { error: "Too many ads posted today. Please try again tomorrow." };
  }
  let result;
  try {
    result = await publishPartListing(user.id, parsed.data, {
      dealerId: dealer?.id,
      publisher: dealer ? (dealer.verifiedAt ? "verified_dealer" : "unverified_dealer") : "individual",
    });
  } catch (error) {
    if (error instanceof ListingQuotaError) return { error: error.message };
    if (error instanceof ListingInputError) return { error: "Please fix the highlighted fields.", fieldErrors: { [error.field]: error.message } };
    if (error instanceof UploadOwnershipError) {
      return { error: error.message, fieldErrors: { imageKeys: error.message } };
    }
    throw error;
  }
  revalidatePath("/auto-parts");
  redirect(`${buildListingPath("part", result.slug, result.listingId)}?posted=1${result.strippedContact ? "&stripped=1" : ""}`);
}

export async function createBikeListingAction(
  _prev: SellState,
  formData: FormData,
): Promise<SellState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/sell/bike");
  requirePostingPhone(user);

  const bikeType = String(formData.get("bikeType") ?? "motorcycle");
  const isElectric = bikeType.startsWith("electric-");
  const parsed = bikeListingSchema.safeParse({
    variantId: num(formData.get("variantId")),
    customMakeName: optionalText(formData.get("customMakeName")),
    customModelName: optionalText(formData.get("customModelName")),
    customVariantName: optionalText(formData.get("customVariantName")),
    bikeType,
    condition: formData.get("condition"),
    isElectric,
    cityId: num(formData.get("cityId")),
    areaId: num(formData.get("areaId")),
    customCityName: optionalText(formData.get("customCityName")),
    customAreaName: optionalText(formData.get("customAreaName")),
    exactLatitude: num(formData.get("exactLatitude")),
    exactLongitude: num(formData.get("exactLongitude")),
    registeredCityId: num(formData.get("registeredCityId")),
    isUnregistered: formData.get("isUnregistered") === "on",
    year: num(formData.get("year")),
    mileageKm: num(formData.get("mileageKm")),
    pricePkr: num(formData.get("pricePkr")),
    assembly: formData.get("assembly") ?? "local",
    color: (formData.get("color") as string) || undefined,
    hasDocuments: formData.get("hasDocuments") === "on",
    ignitionType: formData.get("ignitionType") || undefined,
    engineType: formData.get("engineType") || undefined,
    numberOfGears: num(formData.get("numberOfGears")),
    motorPowerWatts: num(formData.get("motorPowerWatts")),
    batteryType: formData.get("batteryType") || undefined,
    batteryVoltage: num(formData.get("batteryVoltage")),
    batteryCapacityAh: num(formData.get("batteryCapacityAh")),
    claimedRangeKm: num(formData.get("claimedRangeKm")),
    topSpeedKph: num(formData.get("topSpeedKph")),
    chargingTimeMinutes: num(formData.get("chargingTimeMinutes")),
    batteryHealthPercent: num(formData.get("batteryHealthPercent")),
    batteryRemovable: formData.get("batteryRemovable") === "on",
    chargerIncluded: formData.get("chargerIncluded") === "on",
    batteryWarrantyMonths: num(formData.get("batteryWarrantyMonths")),
    isNegotiable: formData.get("isNegotiable") === "on",
    description: (formData.get("description") as string) || undefined,
    featureIds: formData.getAll("featureIds").map(Number).filter(Number.isFinite),
    customFeatureNames: customFeatures(formData.get("customFeatureNames")),
    imageKeys: formData.getAll("imageKeys").map(String).filter(Boolean),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const [dealer] = await db.select({ id: dealers.id, verifiedAt: dealers.verifiedAt })
    .from(dealers).where(eq(dealers.userId, user.id)).limit(1);
  if (!await allowListingPublication(user.id)) {
    return { error: "Too many ads posted today. Please try again tomorrow." };
  }
  let result;
  try {
    result = await publishBikeListing(user.id, parsed.data, {
      dealerId: dealer?.id,
      publisher: dealer ? (dealer.verifiedAt ? "verified_dealer" : "unverified_dealer") : "individual",
    });
  } catch (error) {
    if (error instanceof ListingQuotaError) return { error: error.message };
    if (error instanceof ListingInputError) return { error: "Please fix the highlighted fields.", fieldErrors: { [error.field]: error.message } };
    if (error instanceof UploadOwnershipError) {
      return { error: error.message, fieldErrors: { imageKeys: error.message } };
    }
    throw error;
  }
  revalidatePath("/used-bikes");
  redirect(`${buildListingPath("bike", result.slug, result.listingId)}?posted=1${result.strippedContact ? "&stripped=1" : ""}`);
}

export async function markSoldAction(listingId: number): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [row] = await db
    .select({ sellerId: listings.sellerId })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  if (!row || row.sellerId !== user.id) return;
  if (!await allowAccountAction("listing-write",user.id,ACCOUNT_LIMITS.listingWrite)) redirect("/dashboard?limited=1");

  await db
    .update(listings)
    .set({ status: "sold", soldAt: new Date(), updatedAt: new Date() })
    .where(and(eq(listings.id, listingId),eq(listings.sellerId,user.id),eq(listings.status,"active"),isNull(listings.sellerDeletedAt),isNull(listings.redactedAt)));

  revalidatePath("/dashboard");
}

/** Re-queue a corrected rejected listing. Permanently removed listings cannot return. */
export async function resubmitRejectedListingAction(listingId: number): Promise<SellState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const [row] = await db
    .select({ sellerId: listings.sellerId, status: listings.status })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  if (!row || row.sellerId !== user.id) return { error: "Listing not found." };
  if (row.status !== "rejected") {
    return { error: "Only a rejected listing can be resubmitted for review." };
  }
  if (!await allowAccountAction("listing-write",user.id,ACCOUNT_LIMITS.listingWrite)) return {error:"Too many ad changes. Please wait and try again."};

  try {
    const changed = await db.transaction(async tx => {
      await lockListingOwner(tx, user.id);
      const [current] = await tx.select({id:listings.id}).from(listings)
        .where(and(eq(listings.id,listingId),eq(listings.sellerId,user.id),eq(listings.status,"rejected"),isNull(listings.sellerDeletedAt),isNull(listings.redactedAt)))
        .for("update").limit(1);
      if (!current) return false;
      await assertListingQuota(tx, user.id);
      await tx.update(listings).set({status:"pending_review",updatedAt:new Date()}).where(eq(listings.id,listingId));
      return true;
    });
    if (!changed) return {error:"This rejected listing can no longer be changed."};
  } catch(error) {
    if(error instanceof ListingQuotaError) return {error:error.message};
    throw error;
  }
  revalidatePath("/dashboard");
  return { notice: "Your corrected ad has been submitted for another review." };
}

export async function correctRejectedListingAction(
  listingId: number,
  _prev: SellState,
  formData: FormData,
): Promise<SellState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  const parsed = z.object({
    pricePkr: z.number().int("Enter a whole price in PKR.").min(50_000, "Price looks too low."),
    mileageKm: z.number().int("Enter whole kilometres.").min(0, "Mileage cannot be negative."),
    description: z.string().trim().max(5000, "Description is too long.").optional(),
    color: z.string().trim().max(80, "Keep the color under 80 characters.").optional(),
    isNegotiable: z.boolean(),
  }).safeParse({
    pricePkr: num(formData.get("pricePkr")),
    mileageKm: num(formData.get("mileageKm")),
    description: (formData.get("description") as string) || undefined,
    color: (formData.get("color") as string) || undefined,
    isNegotiable: formData.get("isNegotiable") === "on",
  });
  if (!parsed.success) return { error: "Enter a valid price and mileage." };

  const [row] = await db.select({ sellerId: listings.sellerId, status: listings.status })
    .from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!row || row.sellerId !== user.id || row.status !== "rejected") {
    return { error: "This rejected listing can no longer be changed." };
  }
  const { text: description } = sanitizeDescription(parsed.data.description ?? "");
  if (!await allowAccountAction("listing-write",user.id,ACCOUNT_LIMITS.listingWrite)) return {error:"Too many ad changes. Please wait and try again."};
  let changed: boolean;
  try {
    changed = await db.transaction(async (tx) => {
      await lockListingOwner(tx, user.id);
      if (await listingEditHeld(tx,listingId)) return false;
      const [current] = await tx.select({sellerId:listings.sellerId,status:listings.status,sellerDeletedAt:listings.sellerDeletedAt}).from(listings).where(eq(listings.id,listingId)).for("update").limit(1);
      if (!current || current.sellerId!==user.id || current.status!=="rejected" || current.sellerDeletedAt) return false;
      await assertListingQuota(tx, user.id);
      await tx.update(listings).set({
        pricePkr: parsed.data.pricePkr,
        mileageKm: parsed.data.mileageKm,
        description: description || null,
        isNegotiable: parsed.data.isNegotiable,
        status: "pending_review",
        updatedAt: new Date(),
      }).where(eq(listings.id, listingId));
      await tx.update(carDetails).set({ color: parsed.data.color || null }).where(eq(carDetails.listingId, listingId));
      return true;
    });
  } catch (error) {
    if (error instanceof ListingQuotaError) return {error:error.message};
    throw error;
  }
  if (!changed) return {error:"This rejected listing can no longer be changed."};
  revalidatePath("/dashboard");
  revalidatePath("/admin/moderation");
  redirect("/dashboard");
}
