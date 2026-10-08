"use server";

import { headers } from "next/headers";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { listings } from "@/db/schema/listings";
import { users } from "@/db/schema/users";
import { leadEvents } from "@/db/schema/analytics";
import { getCurrentUser } from "@/lib/auth/session";
import { displayPkPhone } from "@/lib/format";
import { allowPublicAction } from "@/lib/security/rate-limit";
import { logSafeError } from "@/lib/operations/safe-error";
import { publicListingEligibility } from "./public-eligibility";

/**
 * PHONE REVEAL
 *
 * This is the moment the product created value, and therefore the most
 * important event in the system. It is:
 *   - the north-star metric (leads per listing, not pageviews),
 *   - the seller's clearest measure of buyer interest,
 *   - an input to the basic seller and dealer dashboards.
 *
 * The number is deliberately NOT in the initial HTML. If it were, scrapers
 * would harvest every seller's number in one crawl and you would have no
 * lead data at all — which is precisely why the incumbent gates it too.
 */

const ANON_COOKIE = "jw_anon";

async function anonId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(ANON_COOKIE)?.value;
  if (existing) return existing;

  const id = randomBytes(16).toString("hex");
  jar.set(ANON_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}

export type RevealResult =
  | { ok: true; phone: string }
  | { ok: false; error: string };

export async function revealPhoneAction(
  listingId: number,
  source = "detail",
): Promise<RevealResult> {
  const [row] = await db
    .select({
      id: listings.id,
      status: listings.status,
      phone: users.phone,
      sellerBanned: users.isBanned,
      sellerClosedAt: users.closedAt,
      sellerAnonymizedAt: users.anonymizedAt,
      sellerDeletedAt: listings.sellerDeletedAt,
    })
    .from(listings)
    .innerJoin(users, eq(listings.sellerId, users.id))
    .where(eq(listings.id, listingId))
    .limit(1);

  if (!row) return { ok: false, error: "Listing not found." };
  if (row.status !== "active" || row.sellerBanned || row.sellerClosedAt || row.sellerAnonymizedAt || row.sellerDeletedAt) {
    return { ok: false, error: "This listing is no longer available." };
  }
  if (!row.phone) {
    return { ok: false, error: "The seller has not provided a mobile number." };
  }

  const user = await getCurrentUser();
  const anon = user ? null : await anonId();
  const h = await headers();
  if (!await allowPublicAction(
    "seller-contact", user ? `user:${user.id}` : `anon:${anon}`,
    h, { max: 60, sourceMax: 300, windowMs: 60 * 60_000 },
  )) {
    return { ok: false, error: "Too many contact requests. Please try again later." };
  }

  // Logging must never break the reveal. A buyer who clicks and gets an error
  // because the analytics insert failed is a lead you actually lost.
  try {
    await db.transaction(async (tx) => {
      await tx.insert(leadEvents).values({
        listingId,
        userId: user?.id ?? null,
        anonId: anon,
        type: "phone_reveal",
        source: /^(detail|search|compare|dealer)$/.test(source) ? source : "detail",
        referrer: h.get("referer")?.slice(0, 500) ?? null,
      });

      await tx
        .update(listings)
        .set({ leadCount: sql`${listings.leadCount} + 1` })
        .where(eq(listings.id, listingId));
    });
  } catch (err) {
    logSafeError("lead.phone_record_failed", err);
  }

  return { ok: true, phone: displayPkPhone(row.phone) };
}

export async function logLeadAction(
  listingId: number,
  type: "whatsapp_click",
  source = "detail",
): Promise<void> {
  const [available] = await db.select({id:listings.id}).from(listings)
    .where(and(eq(listings.id,listingId),publicListingEligibility())).limit(1);
  if (!available || type !== "whatsapp_click") return;
  const user = await getCurrentUser();
  const anon = user ? null : await anonId();

  try {
    if (!await allowPublicAction(
      "seller-contact", user ? `user:${user.id}` : `anon:${anon}`,
      await headers(), { max: 60, sourceMax: 300, windowMs: 60 * 60_000 },
    )) return;
    await db.insert(leadEvents).values({
      listingId,
      userId: user?.id ?? null,
      anonId: anon,
      type,
      source: /^(detail|search|compare|dealer)$/.test(source) ? source : "detail",
    });
  } catch (err) {
    logSafeError("lead.click_record_failed", err);
  }
}
