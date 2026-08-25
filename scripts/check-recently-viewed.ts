import {
  addRecentlyViewed,
  normalizeRecentlyViewed,
  parseRecentlyViewedQuery,
  RECENTLY_VIEWED_LIMIT,
} from "../src/lib/listings/recently-viewed";

const checks = [
  ["invalid browser data is ignored", normalizeRecentlyViewed(null).length === 0],
  ["forged IDs are removed", JSON.stringify(normalizeRecentlyViewed([1, -2, 3.5, "x", 2])) === "[1,2]"],
  ["duplicates retain newest order", JSON.stringify(normalizeRecentlyViewed([4, 2, 4, 1])) === "[4,2,1]"],
  ["current listing moves to front", JSON.stringify(addRecentlyViewed([3, 2, 1], 2)) === "[2,3,1]"],
  ["query parser is bounded", parseRecentlyViewedQuery(Array.from({ length: 50 }, (_, index) => index + 1).join(",")).length === RECENTLY_VIEWED_LIMIT],
] as const;

let failed = 0;
for (const [name, passed] of checks) {
  if (!passed) failed++;
  console.log(`${passed ? "✓" : "✗"} ${name}`);
}
if (failed) process.exit(1);
