import type { SessionUser } from "@/lib/auth/session";

export type ListingVisibilityStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "sold"
  | "expired"
  | "rejected"
  | "removed";

/** Public details are active-only; owners and admins may inspect inactive ads. */
export function canViewListingDetail(
  status: ListingVisibilityStatus,
  sellerId: number,
  user: Pick<SessionUser, "id" | "isAdmin"> | null,
): boolean {
  return status === "active" || user?.isAdmin === true || user?.id === sellerId;
}
