import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pendingUploads } from "@/db/schema/listings";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class UploadOwnershipError extends Error {
  constructor() {
    super("One or more photos are invalid, already used, or belong to another account. Upload them again.");
    this.name = "UploadOwnershipError";
  }
}

/** Atomically converts this user's temporary uploads into listing images. */
export async function claimUploadedImages(
  tx: Transaction,
  userId: number,
  listingId: number,
  keys: string[],
): Promise<void> {
  const uniqueKeys = [...new Set(keys)];
  if (uniqueKeys.length !== keys.length) throw new UploadOwnershipError();

  const claimed = await tx
    .update(pendingUploads)
    .set({ listingId, claimedAt: new Date() })
    .where(and(
      eq(pendingUploads.userId, userId),
      isNull(pendingUploads.claimedAt),
      inArray(pendingUploads.storageKey, uniqueKeys),
    ))
    .returning({ key: pendingUploads.storageKey });

  if (claimed.length !== uniqueKeys.length) throw new UploadOwnershipError();
}
