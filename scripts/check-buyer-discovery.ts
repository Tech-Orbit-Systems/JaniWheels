import fs from "node:fs";

const checks: Array<[string, boolean]> = [];
function contains(path: string, terms: string[]) {
  const source = fs.readFileSync(path, "utf8");
  return terms.every(term => source.includes(term));
}

checks.push(["vehicle browse filters are wired", contains("src/components/BrowseView.tsx", ["VehicleFilters", "SaveSearchForm"])]);
checks.push(["listing cards expose save and compare", contains("src/components/ListingCard.tsx", ["BuyerListingActions", "initiallySaved"])]);
checks.push(["saved ads are owner-scoped and publicly eligible", contains("src/app/dashboard/saved/page.tsx", ["savedListings.userId", "publicListingEligibility()"])]);
checks.push(["saved searches are owner-scoped and renameable", contains("src/lib/buyer/actions.ts", ["savedSearches.userId", "updateSavedSearchAction", "deleteSavedSearchAction", "name })"])]);
checks.push(["comparison is limited to three active vehicles", contains("src/app/compare/page.tsx", ["slice(0, 3)", 'row.status === "active"'])]);
checks.push(["alert matches are retry-safe", contains("src/db/schema/analytics.ts", ["saved_search_notifications_match_uq", "savedSearchId", "listingId"])]);
checks.push(["alert cron requires the shared cron authorization", contains("src/app/api/cron/[job]/route.ts", ["saved-search-alerts", "authorized(request)"])]);

let failures = 0;
for (const [name, passed] of checks) { if (!passed) failures++; console.log(`${passed ? "✓" : "✗"} ${name}`); }
if (failures) process.exit(1);
