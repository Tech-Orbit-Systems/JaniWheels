import { notFound, permanentRedirect } from "next/navigation";
import { after } from "next/server";
import type { Metadata } from "next";
import {
  buildPath,
  parseRange,
  parseSegments,
  VERTICAL_BASE,
  type FacetState,
  type Vertical,
} from "@/lib/seo/facets";
import { decideIndexation } from "@/lib/seo/indexation";
import { dbResolver } from "@/lib/seo/resolver";
import { abs, breadcrumbJsonLd, facetPageTitle, vehicleJsonLd } from "@/lib/seo/jsonld";
import { buildListingPath, parseListingSlug } from "@/lib/listings/slug";
import { getListingDetail, incrementViewCount } from "@/lib/listings/detail";
import { BrowseView } from "@/components/BrowseView";
import { ListingDetail } from "@/components/ListingDetail";
import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs";

/**
 * Shared implementation for /used-cars, /used-bikes and /auto-parts.
 *
 * Order of resolution matters and is not arbitrary. Facet parsing runs FIRST,
 * detail lookup only as a fallback, because detail slugs end in `-{id}` and
 * so do several real model slugs — `mg-5`, `cd-70`, `cg-125`. Sniffing for a
 * trailing number first would swallow /used-bikes/honda-cd-70 as listing #70.
 * Resolving known entities first makes the ambiguity impossible.
 */

export type Params = { segments?: string[] };
export type SearchParams = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Ranges, sort and page live in the query string, never the path. */
function applySearchParams(state: FacetState, sp: SearchParams): FacetState {
  const next = { ...state };

  for (const [key, token] of [
    ["year", "yr"],
    ["price", "pr"],
    ["mileage", "km"],
    ["engine", "cc"],
  ] as const) {
    const raw = one(sp[token]);
    if (raw) {
      const parsed = parseRange(raw);
      if (parsed) next[key] = parsed;
    }
  }

  const sort = one(sp.sort);
  if (sort) next.sort = sort;

  const page = Number(one(sp.page) ?? 1);
  if (Number.isSafeInteger(page) && page > 1) next.page = page;

  return next;
}

type Resolution =
  | { kind: "browse"; state: FacetState; needsReorder: boolean }
  | { kind: "detail"; id: number; requestedSlug: string }
  | null;

async function resolve(
  vertical: Vertical,
  params: Params,
  sp: SearchParams,
): Promise<Resolution> {
  const segments = params.segments ?? [];
  const parsed = await parseSegments(vertical, segments, dbResolver);

  if (parsed.unknown.length === 0) {
    return {
      kind: "browse",
      state: applySearchParams(parsed.state, sp),
      needsReorder: parsed.needsReorder,
    };
  }

  if (segments.length === 1) {
    const detail = parseListingSlug(segments[0]);
    if (detail) return { kind: "detail", id: detail.id, requestedSlug: detail.slug };
  }

  // Never silently drop an unknown segment, or /used-cars/toyota-corolla/banana
  // would serve the Corolla page and get itself indexed as a duplicate.
  return null;
}

const NOUN: Record<Vertical, string> = {
  car: "Used Cars",
  bike: "Used Bikes",
  part: "Auto Parts",
};

export async function verticalMetadata(
  vertical: Vertical,
  params: Promise<Params>,
  searchParams: Promise<SearchParams>,
): Promise<Metadata> {
  const resolved = await resolve(vertical, await params, await searchParams);
  if (!resolved) return { title: "Not found" };

  if (resolved.kind === "detail") {
    const listing = await getListingDetail(resolved.id, vertical);
    if (!listing) return { title: "Not found" };

    const url = buildListingPath(vertical, listing.slug, listing.id);
    const isLive = listing.status === "active";

    return {
      title: `${listing.title} for sale in ${listing.cityName} | AutoBazaar`,
      description:
        listing.description?.slice(0, 155) ??
        `${listing.title} for sale in ${listing.cityName}.`,
      alternates: { canonical: abs(url) },
      // A sold or expired listing must leave the index; leaving it there is
      // how a site accumulates thousands of dead pages.
      robots: { index: isLive, follow: true },
      openGraph: {
        title: listing.title,
        url: abs(url),
        type: "website",
        images: listing.images[0]
          ? [{ url: abs(`/uploads/${listing.images[0].key}`) }]
          : undefined,
      },
    };
  }

  const { state } = resolved;
  const decision = decideIndexation(state);
  const title = facetPageTitle(state);
  const where = state.city?.name ?? "Pakistan";
  const subject =
    state.model?.name ?? state.make?.name ?? state.category?.name ?? NOUN[vertical];

  return {
    title: `${title} | AutoBazaar`,
    description: `Find ${subject} for sale in ${where}. Compare prices and condition, see how each price compares to the market, and contact sellers directly.`,
    alternates: { canonical: abs(decision.canonicalPath) },
    robots: { index: decision.robots.startsWith("index"), follow: true },
    openGraph: { title, url: abs(decision.canonicalPath), type: "website" },
  };
}

export async function VerticalPage({
  vertical,
  params,
  searchParams,
}: {
  vertical: Vertical;
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const resolved = await resolve(vertical, await params, await searchParams);
  if (!resolved) notFound();

  if (resolved.kind === "browse") {
    return (
      <BrowseView state={resolved.state} needsReorder={resolved.needsReorder} />
    );
  }

  const listing = await getListingDetail(resolved.id, vertical);
  if (!listing) notFound();

  // The id identifies the row, so the slug is free to drift — a seller edits
  // the title, or the slug format improves. Redirect rather than serve the
  // same listing at two URLs.
  if (listing.slug !== resolved.requestedSlug) {
    permanentRedirect(buildListingPath(vertical, listing.slug, listing.id));
  }

  /**
   * Count the view AFTER the response has streamed, so an analytics write
   * never sits between the buyer and the page.
   *
   * Placed below the slug redirect on purpose: a 308 is not a view, and
   * counting it would double-count every visitor who arrived on a stale slug.
   *
   * Caveat worth knowing: this counts crawler hits too, so `viewCount` runs
   * optimistic. That is tolerable because views are the vanity metric here —
   * `lead_events` is the number anything important is decided on, and that
   * only fires on a deliberate human click.
   */
  after(async () => {
    try {
      await incrementViewCount(listing.id);
    } catch (err) {
      console.error("view count failed", err);
    }
  });

  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: NOUN[vertical], path: VERTICAL_BASE[vertical] },
    {
      name: `${NOUN[vertical]} in ${listing.cityName}`,
      path: buildPath({
        vertical,
        city: {
          id: listing.cityId,
          slug: listing.citySlug,
          name: listing.cityName,
        },
      }),
    },
    ...(listing.modelId && listing.modelSlug && listing.makeSlug
      ? [
          {
            name: `${listing.makeName} ${listing.modelName}`,
            path: buildPath({
              vertical,
              model: {
                id: listing.modelId,
                slug: listing.modelSlug,
                name: listing.modelName ?? "",
                makeSlug: listing.makeSlug,
              },
            }),
          },
        ]
      : []),
    {
      name: listing.title,
      path: buildListingPath(vertical, listing.slug, listing.id),
    },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      {vertical !== "part" && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              vehicleJsonLd({
                id: listing.id,
                url: buildListingPath(vertical, listing.slug, listing.id),
                title: listing.title,
                description: listing.description,
                pricePkr: listing.pricePkr,
                year: listing.year,
                mileageKm: listing.mileageKm,
                makeName: listing.makeName,
                modelName: listing.modelName,
                bodyType: listing.bodyType,
                fuel: listing.fuel,
                transmission: listing.transmission,
                engineCc: listing.engineCc,
                color: listing.color,
                cityName: listing.cityName,
                imageUrls: listing.images.map((i) => `/uploads/${i.key}`),
                publishedAt: listing.publishedAt,
                isSold: listing.status === "sold",
              }),
            ),
          }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(crumbs)) }}
      />

      <Breadcrumbs crumbs={crumbs} />

      <h1 className="mb-1 text-xl font-semibold text-slate-900 sm:text-2xl">
        {listing.title}
      </h1>
      <p className="mb-5 text-sm text-slate-500">
        {listing.areaName ? `${listing.areaName}, ` : ""}
        {listing.cityName}
      </p>

      {listing.status !== "active" && (
        <p className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This listing is no longer active.
        </p>
      )}

      <ListingDetail listing={listing} />
    </main>
  );
}
