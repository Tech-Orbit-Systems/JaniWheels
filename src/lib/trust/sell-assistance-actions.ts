"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { listings } from "@/db/schema/listings";
import { makes, models } from "@/db/schema/taxonomy";
import { sellAssistanceEvents, sellAssistanceRequests } from "@/db/schema/trust";
import { users } from "@/db/schema/users";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizePkPhone } from "@/lib/format";
import { allowPublicAction } from "@/lib/security/rate-limit";
import {
  isSellAssistanceStatus,
  validateSellAssistanceUpdate,
} from "./sell-assistance-policy";

const currentYear = new Date().getFullYear() + 1;
const requestSchema = z.object({
  listingId: z.number().int().positive().optional(),
  cityId: z.number().int().positive("Choose a city."),
  makeId: z.number().int().positive("Choose a make."),
  modelId: z.number().int().positive("Choose a model."),
  year: z.number().int().min(1940, "Enter a valid model year.").max(currentYear, "Model year cannot be in the future."),
  mileageKm: z.number().int().min(0, "Mileage cannot be negative.").max(2_000_000, "Check the mileage entered."),
  registrationCity: z.string().trim().min(2, "Enter the registration city.").max(80),
  ownershipStatus: z.enum(["own_name", "open_letter", "bank_financed", "company_owned", "other"], { message: "Choose the ownership status." }),
  vehicleCondition: z.enum(["excellent", "good", "fair", "needs_work", "accidental"], { message: "Choose the vehicle condition." }),
  expectedPricePkr: z.number().int().min(50_000, "Expected price must be at least PKR 50,000.").max(500_000_000, "Check the expected price entered.").optional(),
  sellingTimeline: z.enum(["urgent", "within_month", "one_to_three_months", "exploring"], { message: "Choose when you want to sell." }),
  address: z.string().trim().min(5, "Enter the vehicle location.").max(240),
  contactPhone: z.string().min(10, "Enter your mobile number, e.g. 0300 1234567.").max(20, "That number is too long."),
  preferredContact: z.enum(["phone", "whatsapp", "either"], { message: "Choose a contact method." }),
  bestContactTime: z.string().trim().max(80).optional(),
  sellerNotes: z.string().trim().max(1500, "Notes must be 1,500 characters or fewer.").optional(),
});

export interface SellAssistanceState {
  ok?: boolean;
  reference?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function requestSellAssistanceAction(
  _previous: SellAssistanceState,
  formData: FormData,
): Promise<SellAssistanceState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/sell-my-car");
  const numberOrUndefined = (name: string) => {
    const raw = String(formData.get(name) ?? "").trim();
    return raw ? Number(raw) : undefined;
  };
  const parsed = requestSchema.safeParse({
    listingId: numberOrUndefined("listingId"),
    cityId: Number(formData.get("cityId")),
    makeId: Number(formData.get("makeId")),
    modelId: Number(formData.get("modelId")),
    year: Number(formData.get("year")),
    mileageKm: Number(formData.get("mileageKm")),
    registrationCity: formData.get("registrationCity"),
    ownershipStatus: formData.get("ownershipStatus"),
    vehicleCondition: formData.get("vehicleCondition"),
    expectedPricePkr: numberOrUndefined("expectedPricePkr"),
    sellingTimeline: formData.get("sellingTimeline"),
    address: formData.get("address"),
    contactPhone: formData.get("contactPhone"),
    preferredContact: formData.get("preferredContact"),
    bestContactTime: String(formData.get("bestContactTime") ?? "") || undefined,
    sellerNotes: String(formData.get("sellerNotes") ?? "") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }
  const phone = normalizePkPhone(parsed.data.contactPhone);
  if (!phone) return { error: "Please fix the highlighted fields.", fieldErrors: { contactPhone: "That doesn't look like a PK mobile number." } };

  const [validModel] = await db.select({ id: models.id }).from(models)
    .innerJoin(makes, eq(models.makeId, makes.id))
    .where(and(eq(models.id, parsed.data.modelId), eq(models.makeId, parsed.data.makeId), eq(models.vertical, "car"), eq(models.isActive, true), eq(makes.isActive, true))).limit(1);
  if (!validModel) return { error: "Please fix the highlighted fields.", fieldErrors: { modelId: "Choose a model belonging to the selected make." } };

  if (parsed.data.listingId) {
    const [owned] = await db.select({ id: listings.id }).from(listings)
      .where(and(eq(listings.id, parsed.data.listingId), eq(listings.sellerId, user.id), eq(listings.vertical, "car"))).limit(1);
    if (!owned) return { error: "The selected ad is not available for assistance." };
  }

  if (!await allowPublicAction(
    "sell-assistance-request", `user:${user.id}`, await headers(),
    { max: 3, sourceMax: 60, windowMs: 24 * 60 * 60_000 },
  )) {
    return { error: "Too many assistance requests. Please try again tomorrow." };
  }

  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(sellAssistanceRequests).values({
      requestedByUserId: user.id,
      listingId: parsed.data.listingId ?? null,
      cityId: parsed.data.cityId,
      makeId: parsed.data.makeId,
      modelId: parsed.data.modelId,
      year: parsed.data.year,
      mileageKm: parsed.data.mileageKm,
      registrationCity: parsed.data.registrationCity,
      ownershipStatus: parsed.data.ownershipStatus,
      vehicleCondition: parsed.data.vehicleCondition,
      expectedPricePkr: parsed.data.expectedPricePkr ?? null,
      sellingTimeline: parsed.data.sellingTimeline,
      address: parsed.data.address,
      contactPhone: phone,
      preferredContact: parsed.data.preferredContact,
      bestContactTime: parsed.data.bestContactTime || null,
      sellerNotes: parsed.data.sellerNotes || null,
    }).returning({ id: sellAssistanceRequests.id });
    await tx.insert(sellAssistanceEvents).values({
      requestId: row.id,
      actorUserId: user.id,
      toStatus: "requested",
      customerMessage: "Your Sell My Car Assistance request has been received. Our team will review the details and contact you.",
    });
    return row;
  });
  revalidatePath("/dashboard/sell-assistance");
  revalidatePath("/admin/sell-assistance");
  return { ok: true, reference: `SMC-${created.id}` };
}

export interface SellAssistanceAdminState { ok?: boolean; error?: string }

export async function updateSellAssistanceAction(
  _previous: SellAssistanceAdminState,
  formData: FormData,
): Promise<SellAssistanceAdminState> {
  const admin = await getCurrentUser();
  if (!admin) redirect("/login?next=/admin/sell-assistance");
  const [adminRow] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, admin.id)).limit(1);
  if (!adminRow?.isAdmin) redirect("/");
  const requestId = Number(formData.get("requestId"));
  const next = String(formData.get("status") ?? "");
  const internalNote = String(formData.get("internalNote") ?? "").trim();
  const customerMessage = String(formData.get("customerMessage") ?? "").trim();
  if (!Number.isSafeInteger(requestId) || requestId < 1 || !isSellAssistanceStatus(next)) return { error: "Invalid assistance update." };
  if (internalNote.length > 2000 || customerMessage.length > 1000) return { error: "The note or customer update is too long." };

  const error = await db.transaction(async (tx) => {
    const [current] = await tx.select({ status: sellAssistanceRequests.status }).from(sellAssistanceRequests)
      .where(eq(sellAssistanceRequests.id, requestId)).for("update").limit(1);
    if (!current || !isSellAssistanceStatus(current.status)) return "Assistance request not found.";
    const validation = validateSellAssistanceUpdate({ current: current.status, next, internalNote, customerMessage });
    if (validation) return validation;
    await tx.update(sellAssistanceRequests).set({ status: next, updatedAt: new Date() }).where(eq(sellAssistanceRequests.id, requestId));
    await tx.insert(sellAssistanceEvents).values({ requestId, actorUserId: admin.id, fromStatus: current.status, toStatus: next, internalNote: internalNote || null, customerMessage: customerMessage || null });
    return null;
  });
  if (error) return { error };
  revalidatePath("/admin/sell-assistance");
  revalidatePath("/dashboard/sell-assistance");
  return { ok: true };
}
