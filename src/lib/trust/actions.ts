"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { listingReports, inspections, moderationLog } from "@/db/schema/trust";
import { listings } from "@/db/schema/listings";
import { users } from "@/db/schema/users";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizePkPhone } from "@/lib/format";
import { INSPECTION_PACKAGES } from "@/db/seed/commerce";

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

/** Auto-remove threshold. Deliberately high — see the comment below. */
const AUTO_HIDE_REPORTS = 5;

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
  const anonId = jar.get("ab_anon")?.value ?? null;

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

  await db.insert(listingReports).values({
    listingId: parsed.data.listingId,
    reporterUserId: user?.id ?? null,
    reporterAnonId: anonId,
    reason: parsed.data.reason,
    comment: parsed.data.comment ?? null,
  });

  /**
   * "Sold" is a helpful signal, not an accusation — treat one report as
   * enough to flag it for review, but never auto-remove on report count
   * alone at a low threshold. Auto-hiding on two reports hands anyone a
   * button to delete a competitor's inventory.
   */
  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(listingReports)
    .where(
      and(
        eq(listingReports.listingId, parsed.data.listingId),
        eq(listingReports.status, "open"),
      ),
    );

  if (count >= AUTO_HIDE_REPORTS) {
    await db.transaction(async (tx) => {
      await tx
        .update(listings)
        .set({ status: "pending_review", updatedAt: new Date() })
        .where(eq(listings.id, parsed.data.listingId));

      await tx.insert(moderationLog).values({
        listingId: parsed.data.listingId,
        action: "remove",
        reason: `Auto-hidden after ${count} reports`,
        isAutomated: true,
      });
    });
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Inspections
// ---------------------------------------------------------------------------

const inspectionSchema = z.object({
  packageSlug: z.enum(["basic", "standard", "premium", "pdi"]),
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
    packageSlug: formData.get("packageSlug"),
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

  const pkg = INSPECTION_PACKAGES.find((p) => p.slug === parsed.data.packageSlug);
  if (!pkg) return { error: "Unknown inspection package." };

  const [row] = await db
    .insert(inspections)
    .values({
      listingId: parsed.data.listingId ?? null,
      requestedByUserId: user.id,
      packageSlug: pkg.slug,
      // Price from the server-side catalogue, never from the form.
      pricePkr: pkg.pricePkr,
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
  action: "approve" | "remove",
  reason?: string,
): Promise<{ ok: boolean }> {
  const admin = await requireAdmin();

  await db.transaction(async (tx) => {
    await tx
      .update(listings)
      .set({
        status: action === "approve" ? "active" : "removed",
        publishedAt: action === "approve" ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(listings.id, listingId));

    await tx
      .update(listingReports)
      .set({
        status: action === "approve" ? "dismissed" : "actioned",
        resolvedByUserId: admin.id,
        resolvedAt: new Date(),
      })
      .where(
        and(
          eq(listingReports.listingId, listingId),
          eq(listingReports.status, "open"),
        ),
      );

    // Append-only. When a dealer calls to argue their listing was wrongly
    // pulled, you need the record.
    await tx.insert(moderationLog).values({
      listingId,
      moderatorId: admin.id,
      action,
      reason: reason ?? null,
      isAutomated: false,
    });
  });

  revalidatePath("/admin/moderation");
  revalidatePath("/used-cars");
  return { ok: true };
}
