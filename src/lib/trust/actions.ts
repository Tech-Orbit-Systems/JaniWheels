"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { listingReports, inspections, moderationLog } from "@/db/schema/trust";
import { listings } from "@/db/schema/listings";
import { users } from "@/db/schema/users";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizePkPhone } from "@/lib/format";
import {
  rejectionDecision,
  shouldBanAfterFinalRemoval,
} from "./moderation-policy";

/**
 * Trust actions: reporting bad listings, booking an inspection, and the
 * moderation decisions that follow.
 *
 * Fraud arrives with traction, not after it. Curbstoning, price-bait and
 * stolen vehicles show up the same week a marketplace starts working, and a
 * moderation backlog is very hard to dig out of — so the queue exists before
 * there is a problem rather than after.
 */

const REASONS = [
  "sold",
  "fraud",
  "wrong_price",
  "wrong_category",
  "duplicate",
  "offensive",
  "spam",
  "other",
] as const;

const reportSchema = z.object({
  listingId: z.number().int().positive(),
  reason: z.enum(REASONS),
  comment: z.string().trim().max(1000).optional(),
});

export interface ReportState {
  ok?: boolean;
  error?: string;
}

export async function reportListingAction(
  _prev: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const parsed = reportSchema.safeParse({
    listingId: Number(formData.get("listingId")),
    reason: formData.get("reason"),
    comment: (formData.get("comment") as string) || undefined,
  });

  if (!parsed.success) {
    return { error: "Choose a reason." };
  }

  const user = await getCurrentUser();
  const jar = await cookies();
  let anonId = user ? null : (jar.get("jw_anon")?.value ?? null);
  if (!user && !anonId) {
    anonId = randomBytes(16).toString("hex");
    jar.set("jw_anon", anonId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  // One report per person per listing. Without this, a competitor can file
  // fifty reports and trip any automated threshold you set.
  const [existing] = await db
    .select({ id: listingReports.id })
    .from(listingReports)
    .where(
      and(
        eq(listingReports.listingId, parsed.data.listingId),
        user
          ? eq(listingReports.reporterUserId, user.id)
          : anonId
            ? eq(listingReports.reporterAnonId, anonId)
            : sql`false`,
      ),
    )
    .limit(1);

  if (existing) {
    return { ok: true }; // idempotent; don't reveal that they already reported
  }

  await db.transaction(async (tx) => {
    const [report] = await tx.insert(listingReports).values({
      listingId: parsed.data.listingId,
      reporterUserId: user?.id ?? null,
      reporterAnonId: anonId,
      reason: parsed.data.reason,
      comment: parsed.data.comment ?? null,
    }).onConflictDoNothing().returning({ id: listingReports.id });

    if (!report) return;

    // A report is a safety hold, not a removal: immediately hide only a
    // currently public ad and let an administrator decide the outcome.
    const [hidden] = await tx
      .update(listings)
      .set({ status: "pending_review", updatedAt: new Date() })
      .where(
        and(
          eq(listings.id, parsed.data.listingId),
          eq(listings.status, "active"),
        ),
      )
      .returning({ sellerId: listings.sellerId });

    if (hidden) {
      await tx.insert(moderationLog).values({
        listingId: parsed.data.listingId,
        userId: hidden.sellerId,
        action: "queue",
        reason: "Automatically queued for review after a report.",
        isAutomated: true,
      });
    }
  });

  revalidatePath("/admin/moderation");
  revalidatePath("/used-cars");
  revalidatePath("/used-bikes");
  revalidatePath("/auto-parts");

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Inspections
// ---------------------------------------------------------------------------

const inspectionSchema = z.object({
  cityId: z.number().int().positive("Choose a city."),
  address: z.string().trim().min(5, "Where should the inspector go?").max(240),
  // Every constraint needs its own message. Without one Zod emits its raw
  // internal text ("String must contain at least 10 character(s)") straight
  // into the UI, which reads like a crash rather than a correction.
  contactPhone: z
    .string()
    .min(10, "Enter your mobile number, e.g. 0300 1234567.")
    .max(20, "That number is too long."),
  listingId: z.number().int().positive().optional(),
});

export interface InspectionState {
  ok?: boolean;
  reference?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function bookInspectionAction(
  _prev: InspectionState,
  formData: FormData,
): Promise<InspectionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/inspection");

  const listingIdRaw = Number(formData.get("listingId"));

  const parsed = inspectionSchema.safeParse({
    cityId: Number(formData.get("cityId")),
    address: formData.get("address"),
    contactPhone: formData.get("contactPhone"),
    listingId: Number.isSafeInteger(listingIdRaw) && listingIdRaw > 0 ? listingIdRaw : undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const phone = normalizePkPhone(parsed.data.contactPhone);
  if (!phone) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: { contactPhone: "That doesn't look like a PK mobile number." },
    };
  }

  const [row] = await db
    .insert(inspections)
    .values({
      listingId: parsed.data.listingId ?? null,
      requestedByUserId: user.id,
      cityId: parsed.data.cityId,
      address: parsed.data.address,
      contactPhone: phone,
      status: "requested",
    })
    .returning({ id: inspections.id });

  return { ok: true, reference: `INS-${row.id}` };
}

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/moderation");

  const [row] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!row?.isAdmin) redirect("/");
  return user;
}

export async function moderateAction(
  listingId: number,
  action: "approve" | "reject",
  reason?: string,
): Promise<{ ok: boolean; message: string }> {
  const admin = await requireAdmin();
  const cleanReason = reason?.trim();
  if (action === "reject" && (!cleanReason || cleanReason.length < 3)) {
    return { ok: false, message: "Enter a rejection reason of at least 3 characters." };
  }

  const outcome = await db.transaction(async (tx) => {
    const [listing] = await tx
      .select({ sellerId: listings.sellerId, status: listings.status })
      .from(listings)
      .where(eq(listings.id, listingId))
      .limit(1);
    if (!listing) return { ok: false, message: "Listing not found." };
    if (listing.status === "removed") {
      return { ok: false, message: "This listing has already been permanently removed." };
    }

    if (action === "approve") {
      await tx.update(listings).set({ status: "active", publishedAt: new Date(), updatedAt: new Date() }).where(eq(listings.id, listingId));
      await tx.update(listingReports).set({ status: "dismissed", resolvedByUserId: admin.id, resolvedAt: new Date() }).where(and(eq(listingReports.listingId, listingId), eq(listingReports.status, "open")));
      await tx.insert(moderationLog).values({ listingId, userId: listing.sellerId, moderatorId: admin.id, action: "approve", isAutomated: false });
      return { ok: true, message: "Approved — the ad is public again." };
    }

    const [{ count: priorRejections }] = await tx
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(moderationLog)
      .where(and(eq(moderationLog.listingId, listingId), eq(moderationLog.action, "reject")));
    const decision = rejectionDecision(priorRejections);
    await tx.update(listings).set({ status: decision.isFinal ? "removed" : "rejected", updatedAt: new Date() }).where(eq(listings.id, listingId));
    await tx.update(listingReports).set({ status: "actioned", resolvedByUserId: admin.id, resolvedAt: new Date() }).where(and(eq(listingReports.listingId, listingId), eq(listingReports.status, "open")));
    await tx.insert(moderationLog).values({
      listingId, userId: listing.sellerId, moderatorId: admin.id, action: "reject", reason: cleanReason,
      isAutomated: false, metadata: { rejectionNumber: decision.rejectionNumber, final: decision.isFinal },
    });
    if (!decision.isFinal) {
      return { ok: true, message: `Rejected (${decision.rejectionNumber}/3). The owner can correct and resubmit it.` };
    }

    await tx.insert(moderationLog).values({ listingId, userId: listing.sellerId, moderatorId: admin.id, action: "remove", reason: "Permanently removed after the third rejection.", isAutomated: false });
    const [{ count: finalRemovals }] = await tx
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(moderationLog)
      .where(and(eq(moderationLog.userId, listing.sellerId), eq(moderationLog.action, "remove")));
    if (shouldBanAfterFinalRemoval(finalRemovals)) {
      await tx.update(users).set({ isBanned: true }).where(eq(users.id, listing.sellerId));
      await tx.insert(moderationLog).values({ userId: listing.sellerId, moderatorId: admin.id, action: "ban", reason: "Automatically banned after more than 7 listings reached final removal.", isAutomated: true });
      return { ok: true, message: "Removed permanently. The seller was banned after 8 final removals." };
    }
    return { ok: true, message: "Removed permanently after the third rejection." };
  });

  revalidatePath("/admin/moderation");
  revalidatePath("/used-cars");
  revalidatePath("/used-bikes");
  revalidatePath("/auto-parts");
  revalidatePath("/dashboard");
  return outcome;
}
