/**
 * SEO policy checks:  npx tsx scripts/check-seo.ts
 *
 * The facet and indexation logic is the highest-risk code in the project and
 * the only code whose bugs are completely invisible in the UI — a page that
 * should be noindex renders identically to one that should not. These
 * assertions are pure (no database), so they run in a second.
 *
 * Run this before any change to facets.ts or indexation.ts lands.
 */

import { buildPath, parseRange, type FacetState } from "../src/lib/seo/facets";
import { decideIndexation } from "../src/lib/seo/indexation";
import { facetPageTitle } from "../src/lib/seo/jsonld";

let passed = 0;
const failures: string[] = [];

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failures.push(`${name}\n    expected: ${e}\n    actual:   ${a}`);
  }
}

const corolla = { id: 1, slug: "corolla", name: "Corolla", makeSlug: "toyota" };
const toyota = { id: 2, slug: "toyota", name: "Toyota" };
const lahore = { id: 3, slug: "lahore", name: "Lahore" };
const punjab = { id: 4, slug: "punjab", name: "Punjab" };

// ---------------------------------------------------------------------------
// URL construction
// ---------------------------------------------------------------------------

check(
  "root path",
  buildPath({ vertical: "car" }),
  "/used-cars",
);

check(
  "model page",
  buildPath({ vertical: "car", model: corolla }),
  "/used-cars/toyota-corolla",
);

check(
  "model + city",
  buildPath({ vertical: "car", model: corolla, city: lahore }),
  "/used-cars/toyota-corolla/lahore",
);

// A model implies its make. Emitting both would produce two URLs for one
// result set — the exact duplicate-content problem the registry prevents.
check(
  "make is suppressed when model is present",
  buildPath({ vertical: "car", make: toyota, model: corolla }),
  "/used-cars/toyota-corolla",
);

// Likewise a city implies its province.
check(
  "province is suppressed when city is present",
  buildPath({ vertical: "car", city: lahore, province: punjab }),
  "/used-cars/lahore",
);

// Segment order must come from the registry, not from insertion order.
check(
  "canonical ordering is registry order, not object order",
  buildPath({ vertical: "car", city: lahore, transmission: "automatic", model: corolla }),
  "/used-cars/toyota-corolla/lahore/tr_automatic",
);

// Ranges belong in the query string so they never pollute the crawlable path.
check(
  "ranges go to the query string",
  buildPath({ vertical: "car", model: corolla, price: { max: 3_000_000 } }),
  "/used-cars/toyota-corolla?pr=-3000000",
);

check(
  "multiple features sort deterministically",
  buildPath({ vertical: "car", model: corolla, feature: ["sunroof", "abs"] }),
  "/used-cars/toyota-corolla/ft_abs/ft_sunroof",
);

// ---------------------------------------------------------------------------
// Range parsing
// ---------------------------------------------------------------------------

check("range both bounds", parseRange("100-500"), { min: 100, max: 500 });
check("range open lower", parseRange("-500"), { min: undefined, max: 500 });
check("range open upper", parseRange("100-"), { min: 100, max: undefined });
check("range empty is rejected", parseRange("-"), null);
check("range inverted is rejected", parseRange("500-100"), null);
check("range garbage is rejected", parseRange("abc"), null);

// ---------------------------------------------------------------------------
// Indexation policy — the part that decides whether the site ranks
// ---------------------------------------------------------------------------

function decision(state: FacetState) {
  const d = decideIndexation(state);
  return { robots: d.robots, canonical: d.canonicalPath, sitemap: d.inSitemap };
}

check("root is indexable", decision({ vertical: "car" }), {
  robots: "index,follow",
  canonical: "/used-cars",
  sitemap: true,
});

check(
  "model x city is indexable — the highest-value page shape",
  decision({ vertical: "car", model: corolla, city: lahore }),
  {
    robots: "index,follow",
    canonical: "/used-cars/toyota-corolla/lahore",
    sitemap: true,
  },
);

// Three facets deep is past the whitelist. It must demote to its nearest
// indexable ancestor rather than competing with it.
check(
  "model + city + transmission demotes to model + city",
  decision({
    vertical: "car",
    model: corolla,
    city: lahore,
    transmission: "automatic",
  }),
  {
    robots: "noindex,follow",
    canonical: "/used-cars/toyota-corolla/lahore",
    sitemap: false,
  },
);

// The whole point: a price slider must never mint indexable URLs.
check(
  "price range is never indexable",
  decision({ vertical: "car", model: corolla, price: { min: 1e6, max: 3e6 } }),
  {
    robots: "noindex,follow",
    canonical: "/used-cars/toyota-corolla",
    sitemap: false,
  },
);

check(
  "deeply filtered page falls all the way back to a whitelisted combo",
  decision({
    vertical: "car",
    model: corolla,
    city: lahore,
    transmission: "automatic",
    feature: ["sunroof"],
    price: { max: 3_400_000 },
    mileage: { max: 50_000 },
  }),
  {
    robots: "noindex,follow",
    canonical: "/used-cars/toyota-corolla/lahore",
    sitemap: false,
  },
);

// A sorted view is the same content in a different order.
check(
  "sorted view canonicalizes to the unsorted page",
  decision({ vertical: "car", model: corolla, sort: "price_asc" }),
  {
    robots: "noindex,follow",
    canonical: "/used-cars/toyota-corolla",
    sitemap: false,
  },
);

// Page 2 stays indexable and self-canonical — canonicalizing it to page 1
// would hide every listing past the first 25 from the index entirely. But it
// stays out of the sitemap so crawl budget goes to page 1 and the listings.
check(
  "page 2 is self-canonical, indexable, not in sitemap",
  decision({ vertical: "car", model: corolla, page: 2 }),
  {
    robots: "index,follow",
    canonical: "/used-cars/toyota-corolla?page=2",
    sitemap: false,
  },
);

check(
  "bare city page is indexable",
  decision({ vertical: "car", city: lahore }),
  { robots: "index,follow", canonical: "/used-cars/lahore", sitemap: true },
);

check(
  "fuel facet is indexable — hybrid has real search demand",
  decision({ vertical: "car", fuel: "hybrid" }),
  { robots: "index,follow", canonical: "/used-cars/fu_hybrid", sitemap: true },
);

check(
  "fuel + transmission is not whitelisted and demotes",
  decision({ vertical: "car", fuel: "hybrid", transmission: "automatic" }),
  {
    robots: "noindex,follow",
    canonical: "/used-cars/fu_hybrid",
    sitemap: false,
  },
);

// ---------------------------------------------------------------------------
// Titles — every indexable facet must produce a DISTINCT title
// ---------------------------------------------------------------------------
// Two indexable URLs sharing a title is the duplicate-content problem the
// facet whitelist exists to prevent, reintroduced through the copy. This
// caught /used-cars/ft_sunroof rendering the same <h1> as /used-cars.

const titles = new Map<string, string>();
function titleFor(name: string, state: FacetState) {
  const t = facetPageTitle(state);
  const clash = [...titles.entries()].find(([, v]) => v === t);
  if (clash) {
    failures.push(
      `title collision: "${name}" and "${clash[0]}" both render "${t}"`,
    );
  } else {
    passed++;
  }
  titles.set(name, t);
}

titleFor("root", { vertical: "car" });
titleFor("make", { vertical: "car", make: toyota });
titleFor("model", { vertical: "car", model: corolla });
titleFor("model+city", { vertical: "car", model: corolla, city: lahore });
titleFor("city", { vertical: "car", city: lahore });
titleFor("bodyType", { vertical: "car", bodyType: "sedan" });
titleFor("fuel", { vertical: "car", fuel: "hybrid" });
titleFor("origin", { vertical: "car", origin: "japanese" });
titleFor("province", { vertical: "car", province: punjab });
titleFor("feature", { vertical: "car", feature: ["sunroof"] });
titleFor("bikes root", { vertical: "bike" });
titleFor("parts root", { vertical: "part" });

check(
  "feature title reads naturally",
  facetPageTitle({ vertical: "car", feature: ["sunroof"] }),
  "Used Cars with Sunroof for Sale in Pakistan",
);

console.log(`\n  ${passed} passed, ${failures.length} failed\n`);
for (const f of failures) console.error(`  FAIL  ${f}\n`);
process.exit(failures.length === 0 ? 0 : 1);
