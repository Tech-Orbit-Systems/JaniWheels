"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { inspectionEvents, listingReports, inspections, moderationLog } from "@/db/schema/trust";
import { listings } from "@/db/schema/listings";
import { sessions, users } from "@/db/schema/users";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizePkPhone } from "@/lib/format";
import {
  rejectionDecision,
  shouldBanAfterFinalRemoval,
} from "./moderation-policy";
import { isInspectionStatus, validateInspectionUpdate } from "./inspection-policy";
import { ACCOUNT_LIMITS, allowAccountAction, allowPublicAction } from "@/lib/security/rate-limit";
import { publicListingEligibility } from "@/lib/listings/public-eligibility";

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
const AUTO_HIDE_REPORT_THRESHOLD = 5;

const reportSchema = z.object({
  listingId: z.number({ invalid_type_error: "Choose a valid ad." }).int("Choose a valid ad.").positive("Choose a valid ad."),
  reason: z.enum(REASONS, { errorMap: () => ({ message: "Choose a reason." }) }),
  comment: z.string().trim().max(1000, "Keep your comment under 1,000 characters.").optional(),
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

  if (!await allowPublicAction(
    "listing-report",
    user ? `user:${user.id}` : `anon:${anonId}`,
    await headers(),
    { max: 5, sourceMax: 100, windowMs: 60 * 60_000 },
  )) {
    return { error: "Too many reports. Please try again later." };
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

  const outcome = await db.transaction(async (tx) => {
    // Serialize reports for the same ad so concurrent submissions cannot skip the threshold.
    const [listing] = await tx.select({ status: listings.status, sellerDeletedAt: listings.sellerDeletedAt })
      .from(listings).where(and(eq(listings.id, parsed.data.listingId),publicListingEligibility())).for("update").limit(1);
    if (!listing || listing.sellerDeletedAt || listing.status !== "active") {
      return { error: "This ad is no longer available for reporting." };
    }
    const [report] = await tx.insert(listingReports).values({
      listingId: parsed.data.listingId,
      reporterUserId: user?.id ?? null,
      reporterAnonId: anonId,
      reason: parsed.data.reason,
      comment: parsed.data.comment ?? null,
    }).onConflictDoNothing().returning({ id: listingReports.id });

    if (!report) return { ok: true };

    const [{ count: openReports }] = await tx.select({ count: sql<number>`COUNT(*)::int` })
      .from(listingReports).where(and(eq(listingReports.listingId, parsed.data.listingId), eq(listingReports.status, "open")));
    if (openReports < AUTO_HIDE_REPORT_THRESHOLD) return { ok: true };

    // Five independent reports trigger a temporary safety hold for an administrator to review.
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
        reason: `Automatically queued for review after ${AUTO_HIDE_REPORT_THRESHOLD} open reports.`,
        isAutomated: true,
      });
    }
    return { ok: true, hidden: Boolean(hidden) };
  });

  if (outcome.error) return outcome;

  revalidatePath("/admin/moderation");
  revalidatePath("/used-cars");
  revalidatePath("/used-bikes");
  revalidatePath("/auto-parts");

  if ("hidden" in outcome && outcome.hidden) redirect("/report-concern?submitted=1");
  return outcome;
}

// ---------------------------------------------------------------------------
// Inspections
// ---------------------------------------------------------------------------

const inspectionSchema = z.object({
  cityId: z.number().int("Choose a city.").positive("Choose a city."),
  address: z.string().trim().min(5, "Where should the inspector go?").max(240, "Address is too long."),
  // Every constraint needs its own message. Without one Zod emits its raw
  // internal text ("String must contain at least 10 character(s)") straight
  // into the UI, which reads like a crash rather than a correction.
  contactPhone: z
    .string()
    .min(10, "Enter your mobile number, e.g. 0300 1234567.")
    .max(20, "That number is too long."),
  listingId: z.number().int("Choose a valid car listing.").positive("Choose a valid car listing.").optional(),
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
  const listingIdRaw = formData.get("listingId");
  const user = await getCurrentUser();
  if (!user) {
    const next = listingIdRaw === null ? "/inspection" : `/inspection?listingId=${encodeURIComponent(String(listingIdRaw))}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const parsed = inspectionSchema.safeParse({
    cityId: Number(formData.get("cityId")),
    address: formData.get("address"),
    contactPhone: formData.get("contactPhone"),
    listingId: listingIdRaw === null ? undefined : Number(listingIdRaw),
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

  if (!await allowPublicAction(
    "inspection-request", `user:${user.id}`, await headers(),
    { max: 5, sourceMax: 100, windowMs: 24 * 60 * 60_000 },
  )) {
    return { error: "Too many inspection requests. Please try again tomorrow." };
  }

  const row = await db.transaction(async (tx) => {
    if (parsed.data.listingId) {
      const [listing] = await tx.select({ id: listings.id }).from(listings)
        .where(and(eq(listings.id, parsed.data.listingId), eq(listings.vertical, "car"), publicListingEligibility()))
        .limit(1);
      if (!listing) return null;
    }
    const [created] = await tx.insert(inspections).values({
      listingId: parsed.data.listingId ?? null,
      requestedByUserId: user.id,
      cityId: parsed.data.cityId,
      address: parsed.data.address,
      contactPhone: phone,
      status: "requested",
    }).returning({ id: inspections.id });
    await tx.insert(inspectionEvents).values({
      inspectionId: created.id,
      actorUserId: user.id,
      fromStatus: null,
      toStatus: "requested",
      customerMessage: "Your inspection request has been received.",
    });
    return created;
  });

  if (!row) return { error: "This car listing is no longer available for inspection." };
  return { ok: true, reference: `INS-${row.id}` };
}

export interface InspectionAdminState { ok?: boolean; error?: string }

export async function updateInspectionAction(
  _prev: InspectionAdminState,
  formData: FormData,
): Promise<InspectionAdminState> {
  const admin = await requireAdmin();
  const inspectionId = Number(formData.get("inspectionId"));
  if (!await allowAccountAction("admin-write",admin.id,ACCOUNT_LIMITS.adminWrite)) return {error:"Too many administrative changes. Please wait and try again."};
  const nextRaw = String(formData.get("status") ?? "");
  const internalNote = String(formData.get("internalNote") ?? "").trim();
  const customerMessage = String(formData.get("customerMessage") ?? "").trim();
  if (!Number.isSafeInteger(inspectionId) || inspectionId < 1 || !isInspectionStatus(nextRaw)) {
    return { error: "Invalid inspection update." };
  }
  if (internalNote.length > 2000 || customerMessage.length > 1000) {
    return { error: "The note or customer update is too long." };
  }

  const error = await db.transaction(async (tx) => {
    const [current] = await tx.select({ status: inspections.status })
      .from(inspections).where(eq(inspections.id, inspectionId)).for("update").limit(1);
    if (!current || !isInspectionStatus(current.status)) return "Inspection request not found.";
    const validationError = validateInspectionUpdate({ current: current.status, next: nextRaw, internalNote, customerMessage });
    if (validationError) return validationError;

    await tx.update(inspections).set({ status: nextRaw, updatedAt: new Date() }).where(eq(inspections.id, inspectionId));
    await tx.insert(inspectionEvents).values({
      inspectionId,
      actorUserId: admin.id,
      fromStatus: current.status,
      toStatus: nextRaw,
      internalNote: internalNote || null,
      customerMessage: customerMessage || null,
    });
    return null;
  });
  if (error) return { error };
  revalidatePath("/admin/inspections");
  revalidatePath("/dashboard/inspections");
  return { ok: true };
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
  if (!Number.isSafeInteger(listingId) || listingId<1 || !["approve","reject"].includes(action) || (reason!==undefined && typeof reason!=="string")) return {ok:false,message:"Invalid moderation decision."};
  if (!await allowAccountAction("admin-write",admin.id,ACCOUNT_LIMITS.adminWrite)) return {ok:false,message:"Too many administrative changes. Please wait and try again."};
  const cleanReason = reason?.trim();
  if (cleanReason && cleanReason.length>500) return {ok:false,message:"The moderation reason is too long."};
  if (action === "reject" && (!cleanReason || cleanReason.length < 3)) {
    return { ok: false, message: "Enter a rejection reason of at least 3 characters." };
  }

  const outcome = await db.transaction(async (tx) => {
    const [listing] = await tx
      .select({ sellerId: listings.sellerId, status: listings.status })
      .from(listings)
      .where(eq(listings.id, listingId))
      .for("update").limit(1);
    if (!listing) return { ok: false, message: "Listing not found." };
    if (listing.status === "removed") {
      return { ok: false, message: "This listing has already been permanently removed." };
    }
    if (listing.status!=="pending_review") return {ok:false,message:"Only an ad awaiting review can be approved or rejected."};

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

export type AdminListingDecision = "flag" | "reinstate" | "remove";

export async function setAdminListingStateAction(
  listingId: number,
  decision: AdminListingDecision,
  reason?: string,
): Promise<{ ok: boolean; message: string }> {
  const admin = await requireAdmin();
  if (!Number.isSafeInteger(listingId) || listingId<1 || !["flag","reinstate","remove"].includes(decision) || (reason!==undefined && typeof reason!=="string")) return {ok:false,message:"Invalid listing decision."};
  if (!await allowAccountAction("admin-write",admin.id,ACCOUNT_LIMITS.adminWrite)) return {ok:false,message:"Too many administrative changes. Please wait and try again."};
  const cleanReason = reason?.trim();
  if (!cleanReason || cleanReason.length < 5) {
    return { ok: false, message: "Enter a reason of at least 5 characters." };
  }
  if (cleanReason.length > 500) {
    return { ok: false, message: "The moderation reason is too long." };
  }

  const result = await db.transaction(async (tx) => {
    const [listing] = await tx.select({
      sellerId: listings.sellerId,
      status: listings.status,
      sellerDeletedAt: listings.sellerDeletedAt,
    }).from(listings).where(eq(listings.id, listingId)).for("update").limit(1);
    if (!listing || listing.sellerDeletedAt) return { ok: false, message: "Listing not found." };

    const nextStatus = decision === "reinstate" ? "active" : decision === "flag" ? "pending_review" : "removed";
    if (decision === "reinstate" && listing.status === "removed") {
      return { ok: false, message: "Permanently removed ads cannot be reinstated." };
    }
    if (listing.status === nextStatus) {
      return { ok: false, message: `This listing is already ${nextStatus.replace("_", " ")}.` };
    }

    const now = new Date();
    await tx.update(listings).set({
      status: nextStatus,
      updatedAt: now,
      ...(decision === "reinstate" ? { publishedAt: now } : {}),
    }).where(eq(listings.id, listingId));
    await tx.insert(moderationLog).values({
      listingId,
      userId: listing.sellerId,
      moderatorId: admin.id,
      action: decision,
      reason: cleanReason,
      isAutomated: false,
      metadata: { previousStatus: listing.status, nextStatus },
    });
    if (decision !== "flag") {
      await tx.update(listingReports).set({
        status: decision === "reinstate" ? "dismissed" : "actioned",
        resolvedByUserId: admin.id,
        resolvedAt: now,
      }).where(and(eq(listingReports.listingId, listingId), eq(listingReports.status, "open")));
    }
    return {
      ok: true,
      message: decision === "reinstate" ? "Listing reinstated and public." : decision === "flag" ? "Listing hidden and queued for review." : "Listing permanently removed.",
    };
  });
  revalidateModerationSurfaces();
  return result;
}

export async function setUserBanAction(
  targetUserId: number,
  decision: "ban" | "unban",
  reason?: string,
): Promise<{ ok: boolean; message: string }> {
  const admin = await requireAdmin();
  if (!Number.isSafeInteger(targetUserId) || targetUserId<1 || !["ban","unban"].includes(decision) || (reason!==undefined && typeof reason!=="string")) return {ok:false,message:"Invalid user access decision."};
  if (!await allowAccountAction("admin-write",admin.id,ACCOUNT_LIMITS.adminWrite)) return {ok:false,message:"Too many administrative changes. Please wait and try again."};
  const cleanReason = reason?.trim();
  if (!cleanReason || cleanReason.length < 5) {
    return { ok: false, message: "Enter a reason of at least 5 characters." };
  }
  if (cleanReason.length > 500) return { ok: false, message: "The reason is too long." };
  if (targetUserId === admin.id) return { ok: false, message: "You cannot change your own access." };

  const result = await db.transaction(async (tx) => {
    const [target] = await tx.select({ isAdmin: users.isAdmin, isBanned: users.isBanned })
      .from(users).where(eq(users.id, targetUserId)).for("update").limit(1);
    if (!target) return { ok: false, message: "User not found." };
    if (target.isAdmin) return { ok: false, message: "Administrator access cannot be changed here." };
    const shouldBan = decision === "ban";
    if (target.isBanned === shouldBan) return { ok: false, message: `User is already ${shouldBan ? "banned" : "active"}.` };

    await tx.update(users).set({ isBanned: shouldBan, updatedAt: new Date() }).where(eq(users.id, targetUserId));
    if (shouldBan) await tx.delete(sessions).where(eq(sessions.userId, targetUserId));
    await tx.insert(moderationLog).values({
      userId: targetUserId,
      moderatorId: admin.id,
      action: decision,
      reason: cleanReason,
      isAutomated: false,
    });
    return { ok: true, message: shouldBan ? "User banned and active sessions revoked." : "User access restored." };
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin/moderation");
  return result;
}

function revalidateModerationSurfaces() {
  revalidatePath("/admin/moderation");
  revalidatePath("/admin/listings");
  revalidatePath("/used-cars");
  revalidatePath("/used-bikes");
  revalidatePath("/auto-parts");
  revalidatePath("/dashboard");
}
