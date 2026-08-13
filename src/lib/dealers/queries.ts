import "server-only";
import { and, desc, eq, gt, gte, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { dealers } from "@/db/schema/users";
import { dealerPlans, dealerSubscriptions } from "@/db/schema/commerce";
import { listings } from "@/db/schema/listings";
import { leadEvents } from "@/db/schema/analytics";

export const getDealerForUser = cache(async (userId: number) => {
  const [row] = await db
    .select({
      id: dealers.id,
      businessName: dealers.businessName,
      slug: dealers.slug,
      cityId: dealers.cityId,
      verifiedAt: dealers.verifiedAt,
    })
    .from(dealers)
    .where(eq(dealers.userId, userId))
    .limit(1);
  return row ?? null;
});

/**
 * The dealer's current plan, or null if they have no live subscription.
 *
 * Returns the PLAN, not the subscription, because every caller is asking a
 * question about entitlements ("can they bulk upload?", "how many listings?").
 */
export const getActivePlan = cache(async (dealerId: number) => {
  const [row] = await db
    .select({
      planId: dealerPlans.id,
      name: dealerPlans.name,
      slug: dealerPlans.slug,
      listingQuota: dealerPlans.listingQuota,
      featuredQuota: dealerPlans.featuredQuota,
      bulkUpload: dealerPlans.bulkUpload,
      brandedStorefront: dealerPlans.brandedStorefront,
      leadAnalytics: dealerPlans.leadAnalytics,
      endsAt: dealerSubscriptions.endsAt,
    })
    .from(dealerSubscriptions)
    .innerJoin(dealerPlans, eq(dealerSubscriptions.planId, dealerPlans.id))
    .where(
      and(
        eq(dealerSubscriptions.dealerId, dealerId),
        gt(dealerSubscriptions.endsAt, new Date()),
      ),
    )
    .orderBy(desc(dealerSubscriptions.endsAt))
    .limit(1);

  return row ?? null;
});

export interface LeadAnalytics {
  totalLeads: number;
  totalViews: number;
  activeListings: number;
  leadsByDay: { day: string; leads: number }[];
  topListings: {
    id: number;
    title: string;
    slug: string;
    leads: number;
    views: number;
  }[];
  /** Listings live for a week or more with zero leads — the actionable list. */
  coldListings: { id: number; title: string; slug: string; days: number }[];
}

/**
 * Lead analytics.
 *
 * This is what makes a subscription renew. A dealer decides whether to keep
 * paying by asking "did this send me buyers?" — so the answer has to be
 * concrete and it has to include the bad news. The cold-listings panel exists
 * precisely because telling a dealer which six cars are getting no calls is
 * more valuable than another chart of a number going up.
 */
export async function getLeadAnalytics(
  dealerId: number,
  days = 30,
): Promise<LeadAnalytics> {
  const since = new Date(Date.now() - days * 86_400_000);

  const [totals, byDay, top, cold] = await Promise.all([
    db
      .select({
        leads: sql<number>`COALESCE(SUM(${listings.leadCount}), 0)::int`,
        views: sql<number>`COALESCE(SUM(${listings.viewCount}), 0)::int`,
        active: sql<number>`COUNT(*) FILTER (WHERE ${listings.status} = 'active')::int`,
      })
      .from(listings)
      .where(eq(listings.dealerId, dealerId)),

    db
      .select({
        day: sql<string>`TO_CHAR(${leadEvents.createdAt}, 'YYYY-MM-DD')`,
        leads: sql<number>`COUNT(*)::int`,
      })
      .from(leadEvents)
      .innerJoin(listings, eq(leadEvents.listingId, listings.id))
      .where(
        and(
          eq(listings.dealerId, dealerId),
          gte(leadEvents.createdAt, since),
        ),
      )
      .groupBy(sql`TO_CHAR(${leadEvents.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`TO_CHAR(${leadEvents.createdAt}, 'YYYY-MM-DD')`),

    db
      .select({
        id: listings.id,
        title: listings.title,
        slug: listings.slug,
        leads: listings.leadCount,
        views: listings.viewCount,
      })
      .from(listings)
      .where(and(eq(listings.dealerId, dealerId), eq(listings.status, "active")))
      .orderBy(desc(listings.leadCount))
      .limit(8),

    db
      .select({
        id: listings.id,
        title: listings.title,
        slug: listings.slug,
        days: sql<number>`EXTRACT(DAY FROM NOW() - ${listings.publishedAt})::int`,
      })
      .from(listings)
      .where(
        and(
          eq(listings.dealerId, dealerId),
          eq(listings.status, "active"),
          eq(listings.leadCount, 0),
          sql`${listings.publishedAt} < NOW() - INTERVAL '7 days'`,
        ),
      )
      .orderBy(desc(sql`NOW() - ${listings.publishedAt}`))
      .limit(10),
  ]);

  return {
    totalLeads: totals[0]?.leads ?? 0,
    totalViews: totals[0]?.views ?? 0,
    activeListings: totals[0]?.active ?? 0,
    leadsByDay: byDay,
    topListings: top,
    coldListings: cold,
  };
}
