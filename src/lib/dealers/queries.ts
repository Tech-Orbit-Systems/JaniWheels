import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { dealers } from "@/db/schema/users";
import { listings } from "@/db/schema/listings";
import { moderationLog } from "@/db/schema/trust";

export const getDealerForUser = cache(async (userId: number) => {
  const [row] = await db
    .select({
      id: dealers.id,
      businessName: dealers.businessName,
      slug: dealers.slug,
      cityId: dealers.cityId,
      address: dealers.address,
      logoUrl: dealers.logoUrl,
      about: dealers.about,
      landline: dealers.landline,
      whatsapp: dealers.whatsapp,
      verifiedAt: dealers.verifiedAt,
    })
    .from(dealers)
    .where(eq(dealers.userId, userId))
    .limit(1);
  return row ?? null;
});

export async function getLatestDealerVerificationDecision(userId: number) {
  const [row] = await db
    .select({
      action: moderationLog.action,
      reason: moderationLog.reason,
      createdAt: moderationLog.createdAt,
    })
    .from(moderationLog)
    .where(and(
      eq(moderationLog.userId, userId),
      inArray(moderationLog.action, [
        "dealer_verify",
        "dealer_revoke",
        "dealer_review_reset",
      ]),
    ))
    .orderBy(desc(moderationLog.createdAt))
    .limit(1);
  return row ?? null;
}

export async function getDealerDashboardStats(dealerId: number) {
  const [row] = await db
    .select({
      totalListings: sql<number>`COUNT(*)::int`,
      activeListings: sql<number>`COUNT(*) FILTER (WHERE ${listings.status} = 'active')::int`,
      pendingListings: sql<number>`COUNT(*) FILTER (WHERE ${listings.status} = 'pending_review')::int`,
      soldListings: sql<number>`COUNT(*) FILTER (WHERE ${listings.status} = 'sold')::int`,
      totalLeads: sql<number>`COALESCE(SUM(${listings.leadCount}), 0)::int`,
      totalViews: sql<number>`COALESCE(SUM(${listings.viewCount}), 0)::int`,
    })
    .from(listings)
    .where(eq(listings.dealerId, dealerId));

  return {
    totalListings: row?.totalListings ?? 0,
    activeListings: row?.activeListings ?? 0,
    pendingListings: row?.pendingListings ?? 0,
    soldListings: row?.soldListings ?? 0,
    totalLeads: row?.totalLeads ?? 0,
    totalViews: row?.totalViews ?? 0,
  };
}
