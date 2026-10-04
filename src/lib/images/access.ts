import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { dealers, listingImages, listings, pendingUploads, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewListingDetail } from "@/lib/listings/visibility";

export async function canReadStoredImage(key: string): Promise<boolean> {
  const [listing] = await db.select({ status: listings.status, sellerId: listings.sellerId })
    .from(listingImages).innerJoin(listings, eq(listings.id, listingImages.listingId))
    .where(eq(listingImages.storageKey, key)).limit(1);
  if (listing?.status === "active") return true;
  const user = await getCurrentUser();
  if (listing) return canViewListingDetail(listing.status, listing.sellerId, user);

  // Saved identity photos are intentionally public; unfinished uploads are not.
  const [avatar] = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.avatarUrl, key), eq(users.isBanned, false), isNull(users.closedAt))).limit(1);
  if (avatar) return true;
  const [logo] = await db.select({ id: dealers.id }).from(dealers)
    .innerJoin(users, eq(users.id, dealers.userId))
    .where(and(eq(dealers.logoUrl, key), eq(users.isBanned, false), isNull(users.closedAt))).limit(1);
  if (logo) return true;
  if (!user) return false;
  const [upload] = await db.select({ userId: pendingUploads.userId }).from(pendingUploads)
    .where(eq(pendingUploads.storageKey, key)).limit(1);
  return Boolean(upload && (user.isAdmin || upload.userId === user.id));
}
