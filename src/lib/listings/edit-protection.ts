import { sql } from "drizzle-orm";
import type { db } from "@/db";
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function listingEditHeld(tx: Transaction, listingId: number): Promise<boolean> {
  // Hold creation, account closure and cleanup use this same transaction lock.
  // Checking a hold and editing its evidence must be one serialized operation.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(19403721)`);
  const rows = await tx.execute(sql`SELECT 1 FROM retention_holds h WHERE h.released_at IS NULL AND
    ((h.resource='listing' AND h.resource_id=${listingId}) OR
    (h.resource='report' AND h.resource_id IN (SELECT id FROM listing_reports WHERE listing_id=${listingId})) OR
    (h.resource='moderation' AND h.resource_id IN (SELECT id FROM moderation_log WHERE listing_id=${listingId})))
    UNION ALL SELECT 1 FROM listing_reports WHERE listing_id=${listingId} AND status='open' LIMIT 1`);
  return rows.length>0;
}
