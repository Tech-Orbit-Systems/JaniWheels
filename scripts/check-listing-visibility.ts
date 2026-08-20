import { canViewListingDetail } from "../src/lib/listings/visibility";

const owner = { id: 7, isAdmin: false };
const admin = { id: 99, isAdmin: true };
const otherUser = { id: 8, isAdmin: false };
const statuses = [
  "draft",
  "pending_review",
  "active",
  "sold",
  "expired",
  "rejected",
  "removed",
] as const;

for (const status of statuses) {
  if (!canViewListingDetail(status, 7, owner)) throw new Error(`Owner cannot view ${status}`);
  if (!canViewListingDetail(status, 7, admin)) throw new Error(`Admin cannot view ${status}`);
  const publicExpected = status === "active";
  if (canViewListingDetail(status, 7, otherUser) !== publicExpected) {
    throw new Error(`Unexpected other-user access for ${status}`);
  }
  if (canViewListingDetail(status, 7, null) !== publicExpected) {
    throw new Error(`Unexpected anonymous access for ${status}`);
  }
}

console.log("Listing visibility checks passed: active public; inactive owner/admin only.");
