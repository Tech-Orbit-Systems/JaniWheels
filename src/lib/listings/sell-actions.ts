"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { carDetails, listings } from "@/db/schema/listings";
import { dealers } from "@/db/schema/users";
import { getCurrentUser } from "@/lib/auth/session";
import { carListingSchema, sanitizeDescription } from "./validation";
import { publishCarListing } from "./publish";
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

export async function createCarListingAction(
  _prev: SellState,
  formData: FormData,
): Promise<SellState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/sell");

  const parsed = carListingSchema.safeParse({
    variantId: num(formData.get("variantId")),
    cityId: num(formData.get("cityId")),
    areaId: num(formData.get("areaId")),
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
