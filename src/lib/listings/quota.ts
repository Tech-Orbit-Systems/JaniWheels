import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { listings } from "@/db/schema/listings";
import { dealers, users } from "@/db/schema/users";

type ListingTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const FREE_ACTIVE_LIMIT = 3;

export class ListingQuotaError extends Error {
  constructor() { super(`You already have ${FREE_ACTIVE_LIMIT} live ads. Mark one as sold, or upgrade to a dealer account.`); }
}

export async function lockListingOwner(tx: ListingTx, sellerId: number) {
  const [owner] = await tx.select({ id: users.id }).from(users)
    .where(eq(users.id, sellerId)).for("update").limit(1);
  if (!owner) throw new Error("Listing owner does not exist.");
}

export async function assertListingQuota(tx: ListingTx, sellerId: number) {
  const [dealer] = await tx.select({ id: dealers.id }).from(dealers)
    .where(eq(dealers.userId, sellerId)).limit(1);
  if (dealer) return;
  const [{ active }] = await tx.select({ active: sql<number>`COUNT(*)::int` }).from(listings)
    .where(sql`${listings.sellerId} = ${sellerId} AND ${listings.status} IN ('active','pending_review')`);
  if (active >= FREE_ACTIVE_LIMIT) throw new ListingQuotaError();
}
