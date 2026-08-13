import "server-only";
import { randomInt } from "node:crypto";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  orders,
  adPackages,
  listingPromotions,
  dealerPlans,
  dealerSubscriptions,
} from "@/db/schema/commerce";
import { listings } from "@/db/schema/listings";
import { dealers } from "@/db/schema/users";
import type { CallbackResult, GatewayName } from "./gateway";

/**
 * Order lifecycle.
 *
 * Two invariants carry all the weight here:
 *
 *  1. IDEMPOTENCE. Gateways retry callbacks — on network failure, on timeout,
 *     and sometimes just twice for the same transaction. Crediting a
 *     promotion twice for one payment is a silent revenue leak that nobody
 *     reports because the seller got MORE than they paid for.
 *
 *  2. SERVER-SIDE AMOUNT VALIDATION. The callback tells us what was paid; our
 *     own row says what was owed. If they disagree, the payment is rejected
 *     and flagged — never reconciled in the customer's favour.
 */

export interface CreateOrderInput {
  userId: number;
  listingId: number;
  adPackageId: number;
}

/** AB-2026-4839217 — short enough to read over the phone to support. */
function newReference(): string {
  return `AB-${new Date().getFullYear()}-${randomInt(1_000_000, 9_999_999)}`;
}

export async function createOrder(input: CreateOrderInput) {
  const [pkg] = await db
    .select()
    .from(adPackages)
    .where(
      and(eq(adPackages.id, input.adPackageId), eq(adPackages.isActive, true)),
    )
    .limit(1);

  if (!pkg) throw new Error("Unknown or inactive package");

  // Price comes from the database, never from the request. Otherwise the
  // amount is just a number the browser suggested.
  const [row] = await db
    .insert(orders)
    .values({
      reference: newReference(),
      userId: input.userId,
      listingId: input.listingId,
      adPackageId: pkg.id,
      amountPkr: pkg.pricePkr,
      status: "pending",
    })
    .returning();

  return { order: row, pkg };
}

export async function createSubscriptionOrder(input: {
  userId: number;
  dealerPlanId: number;
}) {
  const [plan] = await db
    .select()
    .from(dealerPlans)
    .where(
      and(
        eq(dealerPlans.id, input.dealerPlanId),
        eq(dealerPlans.isActive, true),
      ),
    )
    .limit(1);

  if (!plan) throw new Error("Unknown or inactive plan");

  const [row] = await db
    .insert(orders)
    .values({
      reference: newReference(),
      userId: input.userId,
      dealerPlanId: plan.id,
      amountPkr: plan.monthlyPricePkr,
      status: "pending",
    })
    .returning();

  return { order: row, plan };
}

export type ApplyResult =
  | { ok: true; alreadyApplied: boolean; listingId: number | null }
  | { ok: false; error: string };

/**
 * Credit a verified payment. Safe to call repeatedly for the same callback.
 */
export async function applyPaidOrder(
  gateway: GatewayName,
  result: CallbackResult,
): Promise<ApplyResult> {
  if (!result.orderReference) {
    return { ok: false, error: "Callback carried no order reference" };
  }

  return db.transaction(async (tx) => {
    // Lock the row so two concurrent callbacks cannot both pass the
    // status check and each create a promotion.
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.reference, result.orderReference!))
      .limit(1)
      .for("update");

    if (!order) return { ok: false as const, error: "Unknown order" };

    if (order.status === "paid") {
      return {
        ok: true as const,
        alreadyApplied: true,
        listingId: order.listingId,
      };
    }

    if (!result.ok) {
      await tx
        .update(orders)
        .set({
          status: "failed",
          gateway,
          gatewayRef: result.gatewayRef ?? null,
          gatewayPayload: result.raw,
        })
        .where(eq(orders.id, order.id));
      return { ok: false as const, error: result.error ?? "Payment declined" };
    }

    // The gateway said paid — but paid how much?
    if (
      result.amountPkr !== undefined &&
      result.amountPkr !== order.amountPkr
    ) {
      await tx
        .update(orders)
        .set({
          status: "failed",
          gateway,
          gatewayRef: result.gatewayRef ?? null,
          gatewayPayload: result.raw,
        })
        .where(eq(orders.id, order.id));

      console.error(
        `AMOUNT MISMATCH on ${order.reference}: expected ${order.amountPkr}, callback said ${result.amountPkr}`,
      );
      return { ok: false as const, error: "Amount mismatch" };
    }

    await tx
      .update(orders)
      .set({
        status: "paid",
        gateway,
        gatewayRef: result.gatewayRef ?? null,
        gatewayPayload: result.raw,
        paidAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    if (order.adPackageId && order.listingId) {
      await grantPromotion(tx, order.id, order.listingId, order.adPackageId);
    }

    if (order.dealerPlanId) {
      await grantSubscription(tx, order.userId, order.dealerPlanId);
    }

    return {
      ok: true as const,
      alreadyApplied: false,
      listingId: order.listingId,
    };
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function grantPromotion(
  tx: Tx,
  orderId: number,
  listingId: number,
  adPackageId: number,
) {
  const [pkg] = await tx
    .select()
    .from(adPackages)
    .where(eq(adPackages.id, adPackageId))
    .limit(1);

  if (!pkg) return;

  const now = new Date();
  const featuredUntil =
    pkg.featuredDays > 0
      ? new Date(now.getTime() + pkg.featuredDays * 86_400_000)
      : null;
  const expiresAt = new Date(now.getTime() + pkg.durationDays * 86_400_000);

  await tx.insert(listingPromotions).values({
    listingId,
    orderId,
    adPackageId,
    featuredUntil,
    bumpsTotal: pkg.bumpCount,
    bumpsUsed: 0,
    homepageSlot: pkg.homepageSlot,
    expiresAt,
  });

  /**
   * Extend rather than overwrite. A seller who buys a second package while
   * the first is still running has paid for both windows, and silently
   * shortening their visibility is the kind of thing that gets noticed once
   * and never forgiven.
   */
  await tx
    .update(listings)
    .set({
      featuredUntil: featuredUntil
        ? sql`GREATEST(COALESCE(${listings.featuredUntil}, NOW()), ${featuredUntil.toISOString()}::timestamptz)`
        : listings.featuredUntil,
      expiresAt: sql`GREATEST(COALESCE(${listings.expiresAt}, NOW()), ${expiresAt.toISOString()}::timestamptz)`,
      bumpedAt: now,
      updatedAt: now,
    })
    .where(eq(listings.id, listingId));
}

/**
 * Extend (or start) a dealer subscription by one month.
 *
 * Renewals extend from the CURRENT expiry, not from today. Renewing three
 * days early otherwise silently costs the dealer three days — small, but the
 * kind of thing that gets noticed once and never trusted again.
 */
async function grantSubscription(
  tx: Tx,
  userId: number,
  planId: number,
) {
  const [dealer] = await tx
    .select({ id: dealers.id })
    .from(dealers)
    .where(eq(dealers.userId, userId))
    .limit(1);

  if (!dealer) return;

  const now = new Date();

  const [current] = await tx
    .select({ id: dealerSubscriptions.id, endsAt: dealerSubscriptions.endsAt })
    .from(dealerSubscriptions)
    .where(
      and(
        eq(dealerSubscriptions.dealerId, dealer.id),
        eq(dealerSubscriptions.planId, planId),
        gt(dealerSubscriptions.endsAt, now),
      ),
    )
    .orderBy(desc(dealerSubscriptions.endsAt))
    .limit(1);

  const from = current?.endsAt && current.endsAt > now ? current.endsAt : now;
  const endsAt = new Date(from.getTime() + 30 * 86_400_000);

  if (current) {
    await tx
      .update(dealerSubscriptions)
      .set({ endsAt })
      .where(eq(dealerSubscriptions.id, current.id));
    return;
  }

  await tx.insert(dealerSubscriptions).values({
    dealerId: dealer.id,
    planId,
    startsAt: now,
    endsAt,
  });
}

/**
 * Consume one bump credit. Returns false when the seller has none left,
 * which the UI shows as an upsell rather than an error.
 */
export async function consumeBump(
  listingId: number,
  userId: number,
): Promise<{ ok: boolean; error?: string; remaining?: number }> {
  return db.transaction(async (tx) => {
    const [listing] = await tx
      .select({ sellerId: listings.sellerId })
      .from(listings)
      .where(eq(listings.id, listingId))
      .limit(1);

    if (!listing || listing.sellerId !== userId) {
      return { ok: false, error: "Not your listing" };
    }

    const [promo] = await tx
      .select()
      .from(listingPromotions)
      .where(
        and(
          eq(listingPromotions.listingId, listingId),
          gt(listingPromotions.expiresAt, new Date()),
          sql`${listingPromotions.bumpsUsed} < ${listingPromotions.bumpsTotal}`,
        ),
      )
      .limit(1)
      .for("update");

    if (!promo) {
      return { ok: false, error: "No bumps remaining" };
    }

    await tx
      .update(listingPromotions)
      .set({ bumpsUsed: promo.bumpsUsed + 1 })
      .where(eq(listingPromotions.id, promo.id));

    await tx
      .update(listings)
      .set({ bumpedAt: new Date(), updatedAt: new Date() })
      .where(eq(listings.id, listingId));

    return { ok: true, remaining: promo.bumpsTotal - promo.bumpsUsed - 1 };
  });
}
