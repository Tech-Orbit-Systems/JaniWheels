/**
 * Whole-site sweep:  npm run sweep
 *
 * Crawls every route shape against a running server and flags anything a
 * visitor would experience as broken: non-200s, pages with no <h1>, pages
 * with almost no content, framework error markers, and images that 404.
 *
 * This exists because status-code checks alone kept passing while real pages
 * were empty or dead — an HTTP 200 is not evidence that a page works.
 */

import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { listings } from "../src/db/schema/listings";
import { models, makes, partCategories } from "../src/db/schema/taxonomy";
import { cities } from "../src/db/schema/geo";
import { dealers } from "../src/db/schema/users";

const BASE = process.env.SWEEP_BASE ?? "http://localhost:3000";

interface Issue {
  url: string;
  problem: string;
}

const issues: Issue[] = [];
let checked = 0;

/** Routes that intentionally redirect when signed out. */
const EXPECT_REDIRECT = new Set([
  "/sell",
  "/dashboard",
  "/dashboard/dealer",
  "/dashboard/dealer/bulk",
  "/admin/moderation",
  "/dealers/register",
]);

async function visit(
  url: string,
  opts: { expectStatus?: number; html?: boolean } = {},
) {
  checked++;
  let res: Response;
  try {
    res = await fetch(BASE + url, { redirect: "manual" });
  } catch (err) {
    issues.push({ url, problem: `request failed: ${String(err)}` });
    return;
  }

  const expected = opts.expectStatus ?? (EXPECT_REDIRECT.has(url) ? 307 : 200);
  if (res.status !== expected) {
    issues.push({ url, problem: `status ${res.status}, expected ${expected}` });
    return;
  }
  if (res.status !== 200) return;

  const html = await res.text();

  const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? html;
  const text = main
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  /**
   * Marker checks run on VISIBLE TEXT, never on raw HTML.
   *
   * Next inlines its not-found component's props ("This page could not be
   * found") into the RSC flight payload of every page in dev, so scanning
   * raw HTML reports a 404 on every healthy page. Stripping <script> first
   * is what makes this check mean anything.
   */
  for (const marker of [
    "Application error",
    "Unhandled Runtime Error",
    "This page could not be found",
    "Internal Server Error",
  ]) {
    if (text.includes(marker)) {
      issues.push({ url, problem: `error marker: "${marker}"` });
      return;
    }
  }

  // robots.txt and sitemap.xml are not HTML documents; holding them to
  // heading and title rules just manufactures noise.
  if (opts.html !== false) {
    if (!/<h1[\s>]/.test(html)) {
      issues.push({ url, problem: "no <h1>" });
    }
    if (!/<title>.+?<\/title>/.test(html)) {
      issues.push({ url, problem: "no <title>" });
    }
    // 80 chars is roughly a heading plus one sentence — below that a page is
    // genuinely empty rather than merely short. /login is legitimately terse.
    if (text.length < 80) {
      issues.push({ url, problem: `near-empty page (${text.length} chars of text)` });
    }
  }

  // Any image the page references that does not resolve is a visible defect.
  const imgs = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((s) => s.startsWith("/") && !s.startsWith("/_next/image"))
    .slice(0, 5);

  for (const src of imgs) {
    const r = await fetch(BASE + src, { method: "HEAD" });
    if (!r.ok) issues.push({ url, problem: `broken image ${src} (${r.status})` });
  }
}

async function main() {
  console.log(`Sweeping ${BASE}\n${"=".repeat(50)}`);

  // ---- static and tool pages --------------------------------------------
  const staticRoutes = [
    "/",
    "/used-cars",
    "/used-bikes",
    "/auto-parts",
    "/dealers",
    "/dealers/register",
    "/price-calculator",
    "/car-finance",
    "/inspection",
    "/login",
    "/sell",
    "/dashboard",
    "/dashboard/dealer",
    "/dashboard/dealer/bulk",
    "/admin/moderation",
    "/promote/failed",
  ];
  for (const r of staticRoutes) await visit(r);

  await visit("/robots.txt", { expectStatus: 200, html: false });
  await visit("/sitemap.xml", { expectStatus: 200, html: false });

  // ---- 404 behaviour -----------------------------------------------------
  for (const r of [
    "/used-cars/toyota-corolla/banana",
    "/auto-parts/not-a-category",
    "/dealers/no-such-dealer",
    "/used-cars/nonexistent-slug-99999999",
  ]) {
    await visit(r, { expectStatus: 404 });
  }

  // ---- facet pages, per vertical ----------------------------------------
  for (const vertical of ["car", "bike"] as const) {
    const base = vertical === "car" ? "/used-cars" : "/used-bikes";

    const topModels = await db
      .select({ full: models.fullSlug })
      .from(models)
      .innerJoin(listings, eq(listings.modelId, models.id))
      .where(and(eq(models.vertical, vertical), eq(listings.status, "active")))
      .groupBy(models.fullSlug)
      .limit(6);

    const topMakes = await db
      .select({ slug: makes.slug })
      .from(makes)
      .where(eq(makes.vertical, vertical))
      .limit(4);

    const topCities = await db
      .select({ slug: cities.slug })
      .from(cities)
      .innerJoin(listings, eq(listings.cityId, cities.id))
      .where(eq(listings.vertical, vertical))
      .groupBy(cities.slug)
      .limit(5);

    for (const m of topModels) {
      await visit(`${base}/${m.full}`);
      if (topCities[0]) await visit(`${base}/${m.full}/${topCities[0].slug}`);
    }
    for (const m of topMakes) await visit(`${base}/${m.slug}`);
    for (const c of topCities) await visit(`${base}/${c.slug}`);

    // enum + range + sort + pagination
    await visit(`${base}?page=2`);
    await visit(`${base}?sort=price_asc`);
    await visit(`${base}?pr=1000000-3000000`);
    if (vertical === "car") {
      await visit(`${base}/bt_sedan`);
      await visit(`${base}/tr_automatic`);
      await visit(`${base}/fu_hybrid`);
      await visit(`${base}/or_japanese`);
      await visit(`${base}/pv_punjab`);
      await visit(`${base}/ft_sunroof`);
    }
  }

  // ---- parts -------------------------------------------------------------
  const cats = await db
    .select({ slug: partCategories.slug })
    .from(partCategories)
    .innerJoin(listings, eq(listings.id, listings.id))
    .groupBy(partCategories.slug)
    .limit(6);
  for (const c of cats) await visit(`/auto-parts/${c.slug}`);

  // ---- detail pages, all three verticals --------------------------------
  for (const vertical of ["car", "bike", "part"] as const) {
    const base =
      vertical === "car" ? "/used-cars" : vertical === "bike" ? "/used-bikes" : "/auto-parts";
    const rows = await db
      .select({ id: listings.id, slug: listings.slug })
      .from(listings)
      .where(and(eq(listings.vertical, vertical), eq(listings.status, "active")))
      .orderBy(sql`RANDOM()`)
      .limit(5);

    if (rows.length === 0) {
      issues.push({ url: base, problem: `no active ${vertical} listings to sample` });
    }
    for (const r of rows) await visit(`${base}/${r.slug}-${r.id}`);
  }

  // ---- dealer storefronts ------------------------------------------------
  const dealerRows = await db.select({ slug: dealers.slug }).from(dealers).limit(5);
  for (const d of dealerRows) await visit(`/dealers/${d.slug}`);

  // ---- price calculator, both branches ----------------------------------
  await visit("/price-calculator?variantId=1&year=2019&modelName=Alto");
  await visit("/price-calculator?variantId=99999&year=2019");

  console.log(`\n  ${checked} URLs checked, ${issues.length} issues\n`);
  for (const i of issues) console.error(`  ✗ ${i.url}\n      ${i.problem}`);
  process.exit(issues.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
