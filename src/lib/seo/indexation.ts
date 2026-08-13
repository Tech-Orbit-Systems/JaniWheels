/**
 * INDEXATION POLICY
 * ============================================================================
 *
 * Decides, for any facet state, whether the page may be indexed and what its
 * canonical URL is.
 *
 * The rule in one sentence: a page is indexable only if a real person would
 * plausibly type it into Google.
 *
 *   "used toyota corolla lahore"     -> yes, index it
 *   "used toyota corolla lahore automatic hybrid sunroof under 3.4m" -> no
 *
 * Everything else is `noindex, follow` — follow so link equity still flows
 * through to listings, noindex so the thin page never enters the index.
 */

import {
  FACETS,
  FACET_LIST,
  activeFacetKeys,
  buildPath,
  type FacetKey,
  type FacetState,
  type Vertical,
} from "./facets";

/**
 * Combinations that earn an indexable page, per vertical.
 * Each entry is a SET of facet keys; order within the set is irrelevant.
 *
 * Keep this list short and deliberate. Every entry you add multiplies the
 * crawlable surface. Start narrow — you can always promote a combination
 * later once you can see it getting impressions in Search Console.
 */
const INDEXABLE_COMBOS: Record<Vertical, FacetKey[][]> = {
  car: [
    [], // /used-cars
    ["make"], // /used-cars/toyota
    ["model"], // /used-cars/toyota-corolla
    ["city"], // /used-cars/lahore
    ["province"], // /used-cars/pv_punjab
    ["bodyType"], // /used-cars/bt_suv
    ["make", "city"], // /used-cars/toyota/lahore
    ["model", "city"], // /used-cars/toyota-corolla/lahore   <- highest value
    ["make", "bodyType"],
    ["bodyType", "city"],
    ["make", "model"], // model implies make; normalized before lookup
    ["make", "model", "city"],
    ["origin"], // /used-cars/or_japanese
    ["transmission", "city"],
    ["fuel"], // /used-cars/fu_hybrid — real search demand
    ["fuel", "city"],
  ],
  bike: [
    [],
    ["make"],
    ["model"],
    ["city"],
    ["make", "city"],
    ["model", "city"],
    ["make", "model"],
    ["make", "model", "city"],
  ],
  part: [
    [],
    ["category"],
    ["city"],
    ["category", "city"],
    ["category", "condition"],
  ],
};

function normalizeKeys(keys: FacetKey[]): FacetKey[] {
  // `model` implies `make`; treat {make, model} and {model} as the same shape
  // so the whitelist doesn't need both spellings of every entry.
  const set = new Set(keys);
  if (set.has("model")) set.delete("make");
  return [...set].sort();
}

function sameSet(a: FacetKey[], b: FacetKey[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((k, i) => k === b[i]);
}

function isWhitelisted(vertical: Vertical, keys: FacetKey[]): boolean {
  const norm = normalizeKeys(keys);
  return INDEXABLE_COMBOS[vertical].some((combo) =>
    sameSet(normalizeKeys(combo), norm),
  );
}

export interface IndexationDecision {
  /** Value for the robots meta tag. */
  robots: "index,follow" | "noindex,follow";
  /** Absolute-path canonical (no origin — the caller prefixes it). */
  canonicalPath: string;
  /** Whether this URL belongs in the XML sitemap. */
  inSitemap: boolean;
  /** Human-readable reason, surfaced in dev tooling and tests. */
  reason: string;
}

/**
 * Find the MOST SPECIFIC whitelisted ancestor of a facet state.
 *
 * Example:
 *   /used-cars/toyota-corolla/lahore/tr_automatic/ft_sunroof?pr=-3000000
 *   canonical = /used-cars/toyota-corolla/lahore
 *
 * Naively dropping facets one at a time by descending order does NOT work,
 * and the bug it produces is subtle. Consider {fuel, transmission}: dropping
 * by order removes `fuel` (32) before `transmission` (31), leaves the
 * non-whitelisted {transmission}, drops that too, and lands on the bare root
 * — throwing away all relevance, when /used-cars/fu_hybrid was whitelisted
 * and sitting right there.
 *
 * So search the subset lattice instead. At most ~8 non-range facets can be
 * active, giving 256 subsets — trivial to enumerate exhaustively. Pick the
 * largest whitelisted subset; break ties toward the higher-value facets
 * (lower `order` wins, so model/city beat transmission/feature).
 */
function nearestIndexableAncestor(state: FacetState): FacetState {
  const working: FacetState = { ...state };
  delete working.page;
  delete working.sort;

  // Ranges can never be part of an indexable URL.
  for (const key of ["year", "price", "mileage", "engine"] as const) {
    delete working[key];
  }

  const active = activeFacetKeys(working);
  if (isWhitelisted(working.vertical, active)) return working;

  let best: FacetKey[] | null = null;
  let bestScore = -1;

  for (let mask = 0; mask < 1 << active.length; mask++) {
    const subset = active.filter((_, i) => mask & (1 << i));
    if (!isWhitelisted(working.vertical, subset)) continue;

    // Prefer more facets; among equal sizes prefer the more valuable ones.
    const orderPenalty = subset.reduce((sum, k) => sum + FACETS[k].order, 0);
    const score = subset.length * 1000 - orderPenalty;

    if (score > bestScore) {
      bestScore = score;
      best = subset;
    }
  }

  // The bare root is always whitelisted, so `best` is never null in practice.
  const keep = new Set(best ?? []);
  for (const def of FACET_LIST) {
    if (def.kind === "range") continue;
    if (!keep.has(def.key)) delete working[def.key];
  }

  // `model` implies `make`, and normalizeKeys treats them as one shape — so a
  // surviving `model` must keep its `make` for buildPath to render correctly.
  if (!keep.has("model")) delete working.model;

  return working;
}

export function decideIndexation(state: FacetState): IndexationDecision {
  const keys = activeFacetKeys(state);

  const hasRange = keys.some((k) => FACETS[k].kind === "range");
  const isSorted = Boolean(state.sort && state.sort !== "recent");
  const isPaged = Boolean(state.page && state.page > 1);

  // --- sorted views are duplicates of the unsorted view -------------------
  if (isSorted) {
    const canonical = { ...state, sort: undefined, page: undefined };
    return {
      robots: "noindex,follow",
      canonicalPath: buildPath(canonical),
      inSitemap: false,
      reason: "sorted view duplicates the default ordering",
    };
  }

  // --- range filters are unbounded URL space ------------------------------
  if (hasRange) {
    return {
      robots: "noindex,follow",
      canonicalPath: buildPath(nearestIndexableAncestor(state)),
      inSitemap: false,
      reason: "range filter — unbounded distinct URLs for one page of content",
    };
  }

  if (!isWhitelisted(state.vertical, keys)) {
    return {
      robots: "noindex,follow",
      canonicalPath: buildPath(nearestIndexableAncestor(state)),
      inSitemap: false,
      reason: `facet combination [${normalizeKeys(keys).join("+") || "root"}] is not whitelisted`,
    };
  }

  // --- paginated pages ----------------------------------------------------
  // Self-canonical and indexable (Google's current guidance — canonicalizing
  // page 2 to page 1 hides those listings entirely), but kept out of the
  // sitemap so crawl budget goes to page 1 and the detail pages.
  if (isPaged) {
    return {
      robots: "index,follow",
      canonicalPath: buildPath(state),
      inSitemap: false,
      reason: "paginated page — self-canonical, excluded from sitemap",
    };
  }

  return {
    robots: "index,follow",
    canonicalPath: buildPath(state),
    inSitemap: true,
    reason: `whitelisted combination [${normalizeKeys(keys).join("+") || "root"}]`,
  };
}

/**
 * Enumerate every indexable facet URL for the sitemap generator.
 * Callers supply the entity rows; this only knows about shapes.
 *
 * Guard rail: a combination is only emitted if it has at least
 * `minListings` live listings behind it. An indexable page with two results
 * is a thin page, and thin pages drag down the domain.
 */
export interface SitemapCandidate {
  keys: FacetKey[];
  vertical: Vertical;
}

export function indexableComboShapes(vertical: Vertical): FacetKey[][] {
  return INDEXABLE_COMBOS[vertical];
}

export const MIN_LISTINGS_FOR_INDEXABLE_PAGE = 3;
