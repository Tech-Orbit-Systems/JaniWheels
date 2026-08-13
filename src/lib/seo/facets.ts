/**
 * FACET REGISTRY
 * ============================================================================
 *
 * This module is the reason the site can rank. Read it before changing any
 * URL in the app.
 *
 * The problem it solves: a used-car search has ~15 filterable dimensions.
 * Exposed naively as crawlable URLs, that is a combinatorial explosion —
 * tens of millions of near-identical thin pages. Google will spend its crawl
 * budget on garbage, conclude the site is low quality, and demote all of it.
 * This is the single most common way classifieds sites fail at SEO, and it
 * is not recoverable quickly.
 *
 * The solution has three parts, all implemented here and in indexation.ts:
 *
 *   1. A CLOSED SET of facets. Anything not in this registry cannot appear
 *      in a path segment at all.
 *   2. DETERMINISTIC ORDERING. /toyota-corolla/lahore and /lahore/toyota-corolla
 *      are the same result set. Only one of them may exist. `buildPath` always
 *      emits segments in registry order, and the route handler 301s anything
 *      that arrives in a different order.
 *   3. AN INDEXATION WHITELIST (indexation.ts). Only combinations that are
 *      genuinely useful to a searcher get `index`. Everything else is
 *      `noindex, follow` with a canonical pointing at its nearest indexable
 *      ancestor.
 */

export type Vertical = "car" | "bike" | "part";

export type FacetKind = "entity" | "enum" | "range" | "flag";

export interface FacetDef {
  key: FacetKey;
  /**
   * URL token prefix. `null` means the segment is bare (no prefix) — reserved
   * for the highest-value dimensions where a clean URL is worth the parsing
   * ambiguity: /used-cars/toyota-corolla/lahore
   */
  token: string | null;
  kind: FacetKind;
  /**
   * Segment order. Lower sorts first in the canonical path. Also used as the
   * drop priority when demoting a URL to its nearest indexable ancestor:
   * higher `order` is dropped first.
   */
  order: number;
  /** Whether this facet may EVER appear in an indexable URL. */
  indexable: boolean;
  verticals: Vertical[];
  label: string;
}

export type FacetKey =
  | "model" // toyota-corolla   (implies make)
  | "make" // toyota
  | "city" // lahore
  | "province" // pv_punjab
  | "category" // parts only
  | "bodyType" // bt_sedan
  | "transmission" // tr_automatic
  | "fuel" // fu_hybrid
  | "assembly" // as_imported
  | "origin" // or_japanese
  | "feature" // ft_sunroof
  | "condition" // cn_new  (parts)
  | "year" // yr_2018-2022
  | "price" // pr_1000000-3000000
  | "mileage" // km_0-50000
  | "engine"; // cc_1000-1500

/**
 * Order matters. Do not reorder casually — it changes every canonical URL on
 * the site, which means every ranking page 301s at once.
 */
export const FACETS: Record<FacetKey, FacetDef> = {
  model: { key: "model", token: null, kind: "entity", order: 10, indexable: true, verticals: ["car", "bike"], label: "Model" },
  make: { key: "make", token: null, kind: "entity", order: 11, indexable: true, verticals: ["car", "bike"], label: "Make" },
  category: { key: "category", token: null, kind: "entity", order: 12, indexable: true, verticals: ["part"], label: "Category" },
  city: { key: "city", token: null, kind: "entity", order: 20, indexable: true, verticals: ["car", "bike", "part"], label: "City" },
  province: { key: "province", token: "pv", kind: "entity", order: 21, indexable: true, verticals: ["car", "bike", "part"], label: "Province" },
  bodyType: { key: "bodyType", token: "bt", kind: "enum", order: 30, indexable: true, verticals: ["car"], label: "Body Type" },
  transmission: { key: "transmission", token: "tr", kind: "enum", order: 31, indexable: true, verticals: ["car"], label: "Transmission" },
  fuel: { key: "fuel", token: "fu", kind: "enum", order: 32, indexable: true, verticals: ["car", "bike"], label: "Fuel Type" },
  assembly: { key: "assembly", token: "as", kind: "enum", order: 33, indexable: true, verticals: ["car"], label: "Assembly" },
  origin: { key: "origin", token: "or", kind: "enum", order: 34, indexable: true, verticals: ["car"], label: "Origin" },
  condition: { key: "condition", token: "cn", kind: "enum", order: 35, indexable: true, verticals: ["part"], label: "Condition" },
  feature: { key: "feature", token: "ft", kind: "enum", order: 40, indexable: true, verticals: ["car"], label: "Feature" },

  // Ranges are NEVER indexable. A price slider generates unbounded distinct
  // URLs for what is effectively one page of content.
  year: { key: "year", token: "yr", kind: "range", order: 50, indexable: false, verticals: ["car", "bike"], label: "Year" },
  price: { key: "price", token: "pr", kind: "range", order: 51, indexable: false, verticals: ["car", "bike", "part"], label: "Price" },
  mileage: { key: "mileage", token: "km", kind: "range", order: 52, indexable: false, verticals: ["car", "bike"], label: "Mileage" },
  engine: { key: "engine", token: "cc", kind: "range", order: 53, indexable: false, verticals: ["car", "bike"], label: "Engine Capacity" },
};

export const FACET_LIST = Object.values(FACETS).sort((a, b) => a.order - b.order);

/** Enum facets have a closed value set; anything else is a 404, not a filter. */
export const ENUM_VALUES: Partial<Record<FacetKey, readonly string[]>> = {
  bodyType: ["hatchback", "sedan", "suv", "crossover", "van", "pickup", "wagon", "coupe", "mpv", "micro-van", "high-roof"],
  transmission: ["manual", "automatic"],
  fuel: ["petrol", "diesel", "hybrid", "electric", "cng", "lpg"],
  assembly: ["local", "imported"],
  origin: ["japanese", "german", "korean", "chinese", "american", "pakistani"],
  condition: ["new", "used", "refurbished"],
  feature: ["sunroof", "alloy-rims", "navigation", "cruise-control", "leather-seats", "360-camera", "abs", "airbags"],
} as const;

export interface RangeValue {
  min?: number;
  max?: number;
}

export interface FacetState {
  vertical: Vertical;
  make?: { id: number; slug: string; name: string };
  model?: { id: number; slug: string; name: string; makeSlug: string };
  city?: { id: number; slug: string; name: string };
  province?: { id: number; slug: string; name: string };
  category?: { id: number; slug: string; name: string };
  bodyType?: string;
  transmission?: string;
  fuel?: string;
  assembly?: string;
  origin?: string;
  condition?: string;
  feature?: string[];
  year?: RangeValue;
  price?: RangeValue;
  mileage?: RangeValue;
  engine?: RangeValue;
  // Not facets, but part of URL identity:
  page?: number;
  sort?: string;
}

export const VERTICAL_BASE: Record<Vertical, string> = {
  car: "/used-cars",
  bike: "/used-bikes",
  part: "/auto-parts",
};

/** Which state keys are actual facets (excludes page/sort/vertical). */
export function activeFacetKeys(state: FacetState): FacetKey[] {
  return FACET_LIST.filter((f) => {
    const v = state[f.key as keyof FacetState];
    if (v === undefined || v === null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (f.kind === "range") {
      const r = v as RangeValue;
      return r.min !== undefined || r.max !== undefined;
    }
    return true;
  }).map((f) => f.key);
}

function serializeRange(r: RangeValue): string {
  return `${r.min ?? ""}-${r.max ?? ""}`;
}

export function parseRange(raw: string): RangeValue | null {
  const m = /^(\d*)-(\d*)$/.exec(raw);
  if (!m) return null;
  const [, a, b] = m;
  if (a === "" && b === "") return null;
  const min = a === "" ? undefined : Number(a);
  const max = b === "" ? undefined : Number(b);
  if (min !== undefined && max !== undefined && min > max) return null;
  return { min, max };
}

/**
 * Build the one true path for a facet state.
 *
 * Always emits segments in registry order so a given result set has exactly
 * one URL. Range facets and sort go in the query string, never the path —
 * they are noindex anyway, and keeping them out of the path stops them from
 * polluting the crawlable namespace.
 */
export function buildPath(state: FacetState): string {
  const base = VERTICAL_BASE[state.vertical];
  const segments: string[] = [];

  for (const def of FACET_LIST) {
    if (!def.verticals.includes(state.vertical)) continue;

    switch (def.key) {
      case "model": {
        if (state.model) segments.push(`${state.model.makeSlug}-${state.model.slug}`);
        break;
      }
      case "make": {
        // A model already implies its make; emitting both would duplicate.
        if (state.make && !state.model) segments.push(state.make.slug);
        break;
      }
      case "category": {
        if (state.category) segments.push(state.category.slug);
        break;
      }
      case "city": {
        if (state.city) segments.push(state.city.slug);
        break;
      }
      case "province": {
        // A city implies its province.
        if (state.province && !state.city) segments.push(`pv_${state.province.slug}`);
        break;
      }
      case "feature": {
        if (state.feature?.length) {
          for (const f of [...state.feature].sort()) segments.push(`ft_${f}`);
        }
        break;
      }
      default: {
        const value = state[def.key as keyof FacetState];
        if (value === undefined) break;
        if (def.kind === "range") {
          // ranges live in the query string — see below
          break;
        }
        segments.push(`${def.token}_${value as string}`);
      }
    }
  }

  const path = segments.length ? `${base}/${segments.join("/")}` : base;

  const qs = new URLSearchParams();
  for (const key of ["year", "price", "mileage", "engine"] as const) {
    const r = state[key];
    if (r && (r.min !== undefined || r.max !== undefined)) {
      qs.set(FACETS[key].token!, serializeRange(r));
    }
  }
  if (state.sort && state.sort !== "recent") qs.set("sort", state.sort);
  if (state.page && state.page > 1) qs.set("page", String(state.page));

  const query = qs.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * Resolver interface so segment parsing stays pure and unit-testable.
 * The DB-backed implementation lives in src/lib/seo/resolver.ts
 */
export interface EntityResolver {
  modelByFullSlug(slug: string, vertical: Vertical): Promise<FacetState["model"] | null>;
  makeBySlug(slug: string, vertical: Vertical): Promise<FacetState["make"] | null>;
  cityBySlug(slug: string): Promise<FacetState["city"] | null>;
  provinceBySlug(slug: string): Promise<FacetState["province"] | null>;
  categoryBySlug(slug: string): Promise<FacetState["category"] | null>;
}

export interface ParseResult {
  state: FacetState;
  /** Segments that matched no facet — the caller must 404 if non-empty. */
  unknown: string[];
  /** True when the incoming segment order differed from canonical order. */
  needsReorder: boolean;
}

/**
 * Parse URL path segments into a FacetState.
 *
 * Bare (untokenized) segments are ambiguous — "lahore" could be a city and
 * "toyota" a make — so they are resolved in a fixed precedence:
 * model -> make -> category -> city. A slug collision between a city and a
 * make would be a data bug; the seed script asserts against it.
 */
export async function parseSegments(
  vertical: Vertical,
  segments: string[],
  resolver: EntityResolver,
): Promise<ParseResult> {
  const state: FacetState = { vertical };
  const unknown: string[] = [];
  const seenOrder: number[] = [];

  for (const raw of segments) {
    const seg = decodeURIComponent(raw).toLowerCase();

    // --- tokenized segments: prefix_value ---------------------------------
    const tokenMatch = /^([a-z]{2})_(.+)$/.exec(seg);
    if (tokenMatch) {
      const [, token, value] = tokenMatch;
      const def = FACET_LIST.find(
        (f) => f.token === token && f.verticals.includes(vertical),
      );
      if (!def) {
        unknown.push(seg);
        continue;
      }

      if (def.key === "province") {
        const p = await resolver.provinceBySlug(value);
        if (!p) { unknown.push(seg); continue; }
        state.province = p;
      } else if (def.key === "feature") {
        if (!ENUM_VALUES.feature?.includes(value)) { unknown.push(seg); continue; }
        state.feature = [...(state.feature ?? []), value];
      } else if (def.kind === "enum") {
        if (!ENUM_VALUES[def.key]?.includes(value)) { unknown.push(seg); continue; }
        Object.assign(state, { [def.key]: value });
      } else if (def.kind === "range") {
        const r = parseRange(value);
        if (!r) { unknown.push(seg); continue; }
        Object.assign(state, { [def.key]: r });
      }
      seenOrder.push(def.order);
      continue;
    }

    // --- bare segments: entity slugs --------------------------------------
    if (vertical !== "part") {
      const model = await resolver.modelByFullSlug(seg, vertical);
      if (model) { state.model = model; seenOrder.push(FACETS.model.order); continue; }

      const make = await resolver.makeBySlug(seg, vertical);
      if (make) { state.make = make; seenOrder.push(FACETS.make.order); continue; }
    } else {
      const cat = await resolver.categoryBySlug(seg);
      if (cat) { state.category = cat; seenOrder.push(FACETS.category.order); continue; }
    }

    const city = await resolver.cityBySlug(seg);
    if (city) { state.city = city; seenOrder.push(FACETS.city.order); continue; }

    unknown.push(seg);
  }

  // A model carries its make implicitly; make it explicit in state so
  // filtering and breadcrumbs don't each have to special-case it.
  if (state.model && !state.make) {
    state.make =
      (await resolver.makeBySlug(state.model.makeSlug, vertical)) ?? undefined;
  }

  const needsReorder = seenOrder.some((v, i) => i > 0 && v < seenOrder[i - 1]);

  return { state, unknown, needsReorder };
}
