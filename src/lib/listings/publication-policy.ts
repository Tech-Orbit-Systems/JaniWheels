export type ListingPublisher =
  | "individual"
  | "unverified_dealer"
  | "verified_dealer";

/**
 * A valid V1 listing goes live immediately, regardless of seller type.
 * Moderation remains post-publication: reports and administrator action can
 * still move a listing out of the public catalogue when there is a reason.
 */
export function initialPublicationState(
  _publisher: ListingPublisher,
  publishedAt: Date,
) {
  return { status: "active" as const, publishedAt };
}
