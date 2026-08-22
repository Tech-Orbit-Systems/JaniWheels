import {
  initialPublicationState,
  type ListingPublisher,
} from "../src/lib/listings/publication-policy";

const publishers: ListingPublisher[] = [
  "individual",
  "unverified_dealer",
  "verified_dealer",
];
const now = new Date("2026-08-22T00:00:00.000Z");

for (const publisher of publishers) {
  const result = initialPublicationState(publisher, now);
  if (result.status !== "active" || result.publishedAt !== now) {
    throw new Error(`${publisher} did not publish immediately.`);
  }
}

console.log("Instant-publication policy: all seller types publish active.");
