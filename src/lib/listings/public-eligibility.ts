import { and, eq, isNull, sql } from "drizzle-orm";
import { listings } from "@/db/schema/listings";
import { users } from "@/db/schema/users";

export function publicListingEligibility() {
  return and(
    eq(listings.status, "active"),
    isNull(listings.sellerDeletedAt),
    isNull(listings.redactedAt),
    sql`EXISTS (SELECT 1 FROM ${users} public_owner WHERE public_owner.id=${listings.sellerId}
      AND public_owner.is_banned=false AND public_owner.closed_at IS NULL AND public_owner.anonymized_at IS NULL)`,
  )!;
}
