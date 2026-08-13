import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { makes, models, variants } from "@/db/schema/taxonomy";
import { cities } from "@/db/schema/geo";
import { listings } from "@/db/schema/listings";
import { publishCarListing } from "@/lib/listings/publish";
import { parseCsv, mapHeaders } from "./csv";

/**
 * BULK INVENTORY IMPORT
 *
 * The single feature dealers reliably pay for. A showroom with thirty cars
 * will not retype them into a web form, so without this they simply do not
 * list — which is why it sits in the paid tier rather than being a nice-to-have.
 *
 * Design decisions that matter:
 *
 *  - VALIDATE EVERYTHING, IMPORT WHAT PASSES. Rejecting a 40-row file because
 *    row 17 has a typo means the dealer gives up. Import the 39 and hand back
 *    a precise, row-numbered list of what failed.
 *
 *  - NEVER GUESS THE TAXONOMY. If "Corrola" does not resolve to a known model,
 *    that row fails with a helpful message. Silently creating a new model
 *    would poison the facet graph and the price data permanently — the exact
 *    thing the curated taxonomy exists to prevent.
 *
 *  - DRY RUN FIRST. The dealer sees what will happen before anything is
 *    written.
 */

export interface RowError {
  row: number;
  field?: string;
  message: string;
}

export interface ParsedRow {
  row: number;
  variantId: number;
  cityId: number;
  year: number;
  pricePkr: number;
  mileageKm: number;
  color?: string;
  assembly: "local" | "imported";
  description?: string;
  label: string;
}

export interface ImportPreview {
  totalRows: number;
  valid: ParsedRow[];
  errors: RowError[];
  unmappedColumns: string[];
}

function cleanNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  // Dealers write "48,50,000", "48.5 lac", "PKR 4850000". Strip everything
  // that is not a digit and let the range validation catch nonsense.
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * "48.5 lacs" and "48,50,000" both mean 4,850,000. If a price parses to
 * something implausibly small, try interpreting it as lacs before failing —
 * this is how prices are actually written in this market.
 */
function normalizePrice(raw: string | undefined): number | null {
  if (!raw) return null;
  const lacMatch = /([\d.]+)\s*(lac|lakh|lacs|lakhs)/i.exec(raw);
  if (lacMatch) return Math.round(Number(lacMatch[1]) * 100_000);

  const croreMatch = /([\d.]+)\s*(crore|cr)\b/i.exec(raw);
  if (croreMatch) return Math.round(Number(croreMatch[1]) * 10_000_000);

  const n = cleanNumber(raw);
  if (n === null) return null;
  // A bare "48" almost certainly means 48 lacs, not 48 rupees.
  if (n > 0 && n < 1000) return n * 100_000;
  return n;
}

const CURRENT_YEAR = new Date().getFullYear();

export async function previewImport(csvText: string): Promise<ImportPreview> {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return {
      totalRows: 0,
      valid: [],
      errors: [{ row: 0, message: "File has no data rows." }],
      unmappedColumns: [],
    };
  }

  const header = rows[0];
  const cols = mapHeaders(header);
  const errors: RowError[] = [];

  for (const required of ["make", "model", "year", "price", "city"]) {
    if (cols[required] === undefined) {
      errors.push({
        row: 0,
        field: required,
        message: `Missing required column "${required}".`,
      });
    }
  }
  if (errors.length) {
    return { totalRows: rows.length - 1, valid: [], errors, unmappedColumns: [] };
  }

  const unmappedColumns = header.filter(
    (_, i) => !Object.values(cols).includes(i),
  );

  // Load the taxonomy once, not per row — a 200-row file would otherwise be
  // 800 queries.
  const [modelRows, cityRows, variantRows] = await Promise.all([
    db
      .select({
        id: models.id,
        name: models.name,
        makeName: makes.name,
      })
      .from(models)
      .innerJoin(makes, eq(models.makeId, makes.id))
      .where(and(eq(models.vertical, "car"), eq(models.isActive, true))),
    db.select({ id: cities.id, name: cities.name }).from(cities),
    db
      .select({
        id: variants.id,
        modelId: variants.modelId,
        name: variants.name,
      })
      .from(variants)
      .where(eq(variants.isActive, true)),
  ]);

  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  const modelIndex = new Map<string, number>();
  for (const m of modelRows) {
    modelIndex.set(key(`${m.makeName}${m.name}`), m.id);
  }
  const cityIndex = new Map(cityRows.map((c) => [key(c.name), c.id]));
  const variantsByModel = new Map<number, typeof variantRows>();
  for (const v of variantRows) {
    const list = variantsByModel.get(v.modelId) ?? [];
    list.push(v);
    variantsByModel.set(v.modelId, list);
  }

  const valid: ParsedRow[] = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const get = (f: string) => cells[cols[f]]?.trim();
    const rowNo = r + 1; // 1-indexed including header, matches the dealer's spreadsheet

    const makeName = get("make");
    const modelName = get("model");
    if (!makeName || !modelName) {
      errors.push({ row: rowNo, field: "make/model", message: "Make and model are required." });
      continue;
    }

    const modelId = modelIndex.get(key(`${makeName}${modelName}`));
    if (!modelId) {
      errors.push({
        row: rowNo,
        field: "model",
        message: `"${makeName} ${modelName}" is not a model we recognise. Check the spelling against our model list.`,
      });
      continue;
    }

    const candidates = variantsByModel.get(modelId) ?? [];
    if (candidates.length === 0) {
      errors.push({
        row: rowNo,
        field: "variant",
        message: `No variants are configured for ${makeName} ${modelName} yet.`,
      });
      continue;
    }

    const variantName = get("variant");
    let variantId: number | undefined;
    if (variantName) {
      const wanted = key(variantName);
      variantId =
        candidates.find((v) => key(v.name) === wanted)?.id ??
        candidates.find((v) => key(v.name).includes(wanted))?.id ??
        candidates.find((v) => wanted.includes(key(v.name)))?.id;
    }
    if (!variantId) {
      if (variantName) {
        errors.push({
          row: rowNo,
          field: "variant",
          message: `Variant "${variantName}" not found for ${makeName} ${modelName}. Valid options: ${candidates.map((v) => v.name).join(", ")}.`,
        });
        continue;
      }
      // No variant column at all — fall back to the first, rather than
      // failing the row. Imperfect, but a listing on the right model is far
      // more useful to everyone than no listing.
      variantId = candidates[0].id;
    }

    const cityName = get("city");
    const cityId = cityName ? cityIndex.get(key(cityName)) : undefined;
    if (!cityId) {
      errors.push({
        row: rowNo,
        field: "city",
        message: `City "${cityName ?? ""}" not recognised.`,
      });
      continue;
    }

    const year = cleanNumber(get("year"));
    if (!year || year < 1970 || year > CURRENT_YEAR + 1) {
      errors.push({ row: rowNo, field: "year", message: `Invalid year "${get("year") ?? ""}".` });
      continue;
    }

    const price = normalizePrice(get("price"));
    if (!price || price < 50_000 || price > 500_000_000) {
      errors.push({ row: rowNo, field: "price", message: `Invalid price "${get("price") ?? ""}".` });
      continue;
    }

    const mileage = cleanNumber(get("mileage")) ?? 0;
    if (mileage > 1_000_000) {
      errors.push({ row: rowNo, field: "mileage", message: "Mileage looks too high." });
      continue;
    }

    const assemblyRaw = (get("assembly") ?? "local").toLowerCase();
    const assembly = assemblyRaw.startsWith("import") ? "imported" : "local";

    valid.push({
      row: rowNo,
      variantId,
      cityId,
      year,
      pricePkr: price,
      mileageKm: mileage,
      color: get("color") || undefined,
      assembly,
      description: get("description") || undefined,
      label: `${makeName} ${modelName} ${year}`,
    });
  }

  return { totalRows: rows.length - 1, valid, errors, unmappedColumns };
}

export interface ImportResult {
  imported: number;
  failed: RowError[];
  quotaBlocked: number;
}

export async function commitImport(
  sellerId: number,
  dealerId: number,
  rows: ParsedRow[],
  quotaRemaining: number,
): Promise<ImportResult> {
  const failed: RowError[] = [];
  let imported = 0;
  let quotaBlocked = 0;

  for (const row of rows) {
    if (imported >= quotaRemaining) {
      quotaBlocked++;
      continue;
    }

    try {
      await publishCarListing(
        sellerId,
        {
          variantId: row.variantId,
          cityId: row.cityId,
          year: row.year,
          pricePkr: row.pricePkr,
          mileageKm: row.mileageKm,
          color: row.color,
          assembly: row.assembly,
          description: row.description,
          isUnregistered: false,
          hasAuctionSheet: false,
          isNegotiable: false,
          featureIds: [],
          /**
           * Imported rows start with no photos and the listing card falls
           * back to its placeholder. Photos are attached afterwards from the
           * dealer console.
           *
           * Deliberately not a fake storage key — that would render as a
           * broken image on every card. And deliberately not fetching the
           * URLs from the CSV inline: a 200-row import would take minutes
           * and fail halfway with no way to resume.
           */
          imageKeys: [],
        },
        { dealerId, autoApprove: true },
      );
      imported++;
    } catch (err) {
      failed.push({
        row: row.row,
        message: err instanceof Error ? err.message : "Could not import this row.",
      });
    }
  }

  return { imported, failed, quotaBlocked };
}

/** How many more listings this dealer may publish under their plan. */
export async function remainingQuota(
  dealerId: number,
  listingQuota: number,
): Promise<number> {
  const [{ active }] = await db
    .select({ active: sql<number>`COUNT(*)::int` })
    .from(listings)
    .where(
      sql`${listings.dealerId} = ${dealerId} AND ${listings.status} IN ('active','pending_review')`,
    );
  return Math.max(0, listingQuota - active);
}
