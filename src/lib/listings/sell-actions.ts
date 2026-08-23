"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { carDetails, listings } from "@/db/schema/listings";
import { dealers } from "@/db/schema/users";
import { getCurrentUser } from "@/lib/auth/session";
import { bikeListingSchema, carListingSchema, partListingSchema, sanitizeDescription } from "./validation";
import { publishBikeListing, publishCarListing, publishPartListing } from "./publish";
import { buildListingPath } from "./slug";

export interface SellState {
  error?: string;
  fieldErrors?: Record<string, string>;
  notice?: string;
}

/** Free listings a private seller may have live at once. */
const FREE_ACTIVE_LIMIT = 3;

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

  const parsed = carListingSchema.safeParse({
    variantId: num(formData.get("variantId")),
    customMakeName: optionalText(formData.get("customMakeName")),
    customModelName: optionalText(formData.get("customModelName")),
    customVariantName: optionalText(formData.get("customVariantName")),
    cityId: num(formData.get("cityId")),
    areaId: num(formData.get("areaId")),
    customCityName: optionalText(formData.get("customCityName")),
    customAreaName: optionalText(formData.get("customAreaName")),
    year: num(formData.get("year")),
    pricePkr: num(formData.get("pricePkr")),
    mileageKm: num(formData.get("mileageKm")),
    registeredCityId: num(formData.get("registeredCityId")),
    isUnregistered: formData.get("isUnregistered") === "on",
    assembly: formData.get("assembly") ?? "local",
    color: (formData.get("color") as string) || undefined,
    ownerCount: num(formData.get("ownerCount")),
    hasAuctionSheet: formData.get("hasAuctionSheet") === "on",
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

  /** Prevent individuals from operating unreviewed dealer-scale inventory. */
  if (!dealer) {
    const [{ active }] = await db
      .select({ active: sql<number>`COUNT(*)::int` })
      .from(listings)
      .where(
        sql`${listings.sellerId} = ${user.id} AND ${listings.status} IN ('active','pending_review')`,
      );

    if (active >= FREE_ACTIVE_LIMIT) {
      return {
        error: `You already have ${FREE_ACTIVE_LIMIT} live ads. Mark one as sold, or upgrade to a dealer account.`,
      };
    }
  }

  const result = await publishCarListing(user.id, parsed.data, {
    dealerId: dealer?.id,
    publisher: dealer
      ? dealer.verifiedAt
        ? "verified_dealer"
        : "unverified_dealer"
      : "individual",
  });

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
  if (!dealer) {
    const [{ active }] = await db.select({ active: sql<number>`COUNT(*)::int` }).from(listings)
      .where(sql`${listings.sellerId} = ${user.id} AND ${listings.status} IN ('active','pending_review')`);
    if (active >= FREE_ACTIVE_LIMIT) {
      return { error: `You already have ${FREE_ACTIVE_LIMIT} live ads. Mark one as sold, or upgrade to a dealer account.` };
    }
  }
  const result = await publishPartListing(user.id, parsed.data, {
    dealerId: dealer?.id,
    publisher: dealer ? (dealer.verifiedAt ? "verified_dealer" : "unverified_dealer") : "individual",
  });
  revalidatePath("/auto-parts");
  redirect(`${buildListingPath("part", result.slug, result.listingId)}?posted=1${result.strippedContact ? "&stripped=1" : ""}`);
}

export async function createBikeListingAction(
  _prev: SellState,
  formData: FormData,
): Promise<SellState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/sell/bike");

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
  if (!dealer) {
    const [{ active }] = await db.select({ active: sql<number>`COUNT(*)::int` }).from(listings)
      .where(sql`${listings.sellerId} = ${user.id} AND ${listings.status} IN ('active','pending_review')`);
    if (active >= FREE_ACTIVE_LIMIT) {
      return { error: `You already have ${FREE_ACTIVE_LIMIT} live ads. Mark one as sold, or upgrade to a dealer account.` };
    }
  }

  const result = await publishBikeListing(user.id, parsed.data, {
    dealerId: dealer?.id,
    publisher: dealer ? (dealer.verifiedAt ? "verified_dealer" : "unverified_dealer") : "individual",
  });
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

  await db
    .update(listings)
    .set({ status: "sold", soldAt: new Date(), updatedAt: new Date() })
    .where(eq(listings.id, listingId));

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

  await db
    .update(listings)
    .set({ status: "pending_review", updatedAt: new Date() })
    .where(eq(listings.id, listingId));
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
    pricePkr: z.number().int().min(50_000),
    mileageKm: z.number().int().min(0),
    description: z.string().trim().max(5000).optional(),
    color: z.string().trim().max(80).optional(),
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
  await db.transaction(async (tx) => {
    await tx.update(listings).set({
      pricePkr: parsed.data.pricePkr,
      mileageKm: parsed.data.mileageKm,
      description: description || null,
      isNegotiable: parsed.data.isNegotiable,
      status: "pending_review",
      updatedAt: new Date(),
    }).where(eq(listings.id, listingId));
    await tx.update(carDetails).set({ color: parsed.data.color || null }).where(eq(carDetails.listingId, listingId));
  });
  revalidatePath("/dashboard");
  revalidatePath("/admin/moderation");
  redirect("/dashboard");
}
