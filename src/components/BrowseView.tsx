import Link from "next/link";
import { buildPath, type FacetState } from "@/lib/seo/facets";
import { decideIndexation } from "@/lib/seo/indexation";
import { breadcrumbJsonLd, facetPageTitle, itemListJsonLd, serializeJsonLd } from "@/lib/seo/jsonld";
import { searchListings } from "@/lib/listings/search";
import { buildListingPath } from "@/lib/listings/slug";
import { ListingCard } from "./ListingCard";
import { Pagination } from "./Pagination";
import { SortSelect } from "./SortSelect";
import { Breadcrumbs, type Crumb } from "./Breadcrumbs";
import { RelatedLinks } from "./RelatedLinks";
import { PartFilters } from "./PartFilters";
import { getPartFilterOptions } from "@/lib/listings/part-filter-options";
import { getVehicleFilterOptions } from "@/lib/listings/vehicle-filter-options";
import { VehicleFilters } from "./VehicleFilters";
import { SaveSearchForm } from "./SaveSearchForm";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/db";
import { savedListings } from "@/db/schema/analytics";
import { and, eq, inArray } from "drizzle-orm";

/**
 * The browse page, shared by all three verticals.
 *
 * Cars, bikes and parts differ in their taxonomy and their detail pages, but
 * the search experience is identical — so it lives here once rather than
 * being copied per vertical and drifting.
 */

const VERTICAL_LABEL = {
  car: "Used Cars",
  bike: "Used Bikes",
  part: "Auto Parts",
} as const;

export async function BrowseView({
  state,
}: {
  state: FacetState;
}) {
  const decision = decideIndexation(state);
  const [results, partFilterOptions, vehicleFilterOptions, user] = await Promise.all([
    searchListings(state),
    state.vertical === "part" ? getPartFilterOptions() : null,
    state.vertical !== "part" ? getVehicleFilterOptions(state.vertical) : null,
    getCurrentUser(),
  ]);
  const heading = facetPageTitle(state);
  const base = buildPath({ vertical: state.vertical });
  const currentPath = buildPath({ ...state, page: undefined });
  const savedRows = user && results.rows.length ? await db.select({ listingId: savedListings.listingId }).from(savedListings)
    .where(and(eq(savedListings.userId, user.id), inArray(savedListings.listingId, results.rows.map(row => row.id)))) : [];
  const savedIds = new Set(savedRows.map(row => row.listingId));

  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: VERTICAL_LABEL[state.vertical], path: base },
    ...(state.make && !state.model
      ? [{ name: state.make.name, path: buildPath({ vertical: state.vertical, make: state.make }) }]
      : []),
    ...(state.model
      ? [{ name: state.model.name, path: buildPath({ vertical: state.vertical, model: state.model }) }]
      : []),
    ...(state.category
      ? [{ name: state.category.name, path: buildPath({ vertical: state.vertical, category: state.category }) }]
      : []),
    ...(state.city
      ? [{ name: state.city.name, path: buildPath({ ...state, page: undefined, sort: undefined }) }]
      : []),
  ];

  const listingUrls = results.rows.map((r) =>
    buildListingPath(state.vertical, r.slug, r.id),
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(crumbs)) }}
      />
      {decision.inSitemap && listingUrls.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemListJsonLd(listingUrls)) }}
        />
      )}

      <Breadcrumbs crumbs={crumbs} />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            {heading}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {results.total.toLocaleString("en-PK")}{" "}
            {results.total === 1 ? "listing" : "listings"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><SaveSearchForm authenticated={Boolean(user)} path={currentPath} vertical={state.vertical} filters={JSON.stringify(state)} defaultName={heading} /><SortSelect state={state} /></div>
      </div>

      {partFilterOptions && <PartFilters state={state} {...partFilterOptions} />}
      {vehicleFilterOptions && <VehicleFilters state={state} {...vehicleFilterOptions} />}

      {process.env.NODE_ENV === "development" && (
        /* Dev-only view of the indexation decision. Getting this wrong is
           silent in production and expensive to discover later. */
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <strong>SEO:</strong> {decision.robots} · canonical{" "}
          <code>{decision.canonicalPath}</code> · sitemap{" "}
          {decision.inSitemap ? "yes" : "no"} — {decision.reason}
        </div>
      )}

      {results.rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
          <p className="text-slate-700">Nothing matches these filters yet.</p>
          <Link
            href={base}
            className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline"
          >
            Clear filters
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.rows.map((row) => (
            <ListingCard key={row.id} row={row} vertical={state.vertical} initiallySaved={savedIds.has(row.id)} />
          ))}
        </ul>
      )}

      <Pagination state={state} page={results.page} pageCount={results.pageCount} />

      {/* Internal linking. This is how crawl depth reaches the long tail of
          model x city pages, and how a browsing user moves sideways instead
          of bouncing back to Google. */}
      <RelatedLinks state={state} />
    </main>
  );
}
