"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { savedListings, savedSearches } from "@/db/schema/analytics";
import { listings } from "@/db/schema/listings";
import { getCurrentUser } from "@/lib/auth/session";
import { publicListingEligibility } from "@/lib/listings/public-eligibility";

export type BuyerActionResult = { ok: boolean; authenticated: boolean; saved?: boolean; message?: string };

export async function toggleSavedListingAction(listingId: number): Promise<BuyerActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, authenticated: false };
  if (!Number.isSafeInteger(listingId) || listingId < 1) return { ok: false, authenticated: true, message: "Invalid listing." };
  const [listing] = await db.select({ id: listings.id }).from(listings)
    .where(and(eq(listings.id, listingId), publicListingEligibility())).limit(1);
  if (!listing) return { ok: false, authenticated: true, message: "This ad is no longer available." };
  const [existing] = await db.select({ listingId: savedListings.listingId }).from(savedListings)
    .where(and(eq(savedListings.userId, user.id), eq(savedListings.listingId, listingId))).limit(1);
  if (existing) {
    await db.delete(savedListings).where(and(eq(savedListings.userId, user.id), eq(savedListings.listingId, listingId)));
    revalidatePath("/dashboard/saved"); return { ok: true, authenticated: true, saved: false };
  }
  await db.insert(savedListings).values({ userId: user.id, listingId }).onConflictDoNothing();
  revalidatePath("/dashboard/saved"); return { ok: true, authenticated: true, saved: true };
}

const searchSchema = z.object({
  name: z.string().trim().min(2, "Enter a search name.").max(80, "Search name is too long."),
  vertical: z.enum(["car", "bike", "part"], { message: "Choose a marketplace." }),
  path: z.string().startsWith("/", "Choose a valid search page.").max(1000, "Search page is too long."),
  filters: z.string().max(5000, "Search filters are too long."),
  alertFrequency: z.enum(["off", "daily", "instant"], { message: "Choose an alert frequency." }),
});

export async function saveSearchAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const parsed = searchSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  let filters: unknown;
  try { filters = JSON.parse(parsed.data.filters); } catch { return; }
  await db.insert(savedSearches).values({ userId: user.id, name: parsed.data.name, vertical: parsed.data.vertical, filters: { state: filters, path: parsed.data.path }, alertFrequency: parsed.data.alertFrequency });
  revalidatePath("/dashboard/saved-searches");
}

export async function updateSavedSearchAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser(); if (!user) return;
  const id = Number(formData.get("id"));
  const frequency = formData.get("alertFrequency");
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (!Number.isSafeInteger(id) || name.length < 2 || name.length > 80 || !["off", "daily", "instant"].includes(String(frequency))) return;
  await db.update(savedSearches).set({ alertFrequency: String(frequency), name })
    .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, user.id)));
  revalidatePath("/dashboard/saved-searches");
}

export async function deleteSavedSearchAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser(); if (!user) return;
  const id = Number(formData.get("id")); if (!Number.isSafeInteger(id)) return;
  await db.delete(savedSearches).where(and(eq(savedSearches.id, id), eq(savedSearches.userId, user.id)));
  revalidatePath("/dashboard/saved-searches");
}
