/**
 * Minimal RFC 4180 CSV parser.
 *
 * Written rather than depended-on because the requirement is narrow and the
 * failure modes matter: dealer inventory exports come out of Excel with
 * quoted fields containing commas ("Lahore, Punjab"), embedded newlines in
 * description columns, and a UTF-8 BOM that turns the first header into
 * "﻿make" and silently breaks column matching.
 *
 * All three are handled here. A naive `split(",")` mangles every one of them.
 */

export function parseCsv(input: string): string[][] {
  // Strip the BOM Excel writes on "CSV UTF-8" export.
  const text = input.replace(/^﻿/, "");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // escaped quote
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }

    if (ch === "\r") {
      i++;
      continue;
    }

    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }

    field += ch;
    i++;
  }

  // Trailing field/row without a terminating newline.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop fully-empty rows (trailing blank lines are near-universal).
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Normalize a header cell for tolerant matching: "Model Year" -> "modelyear" */
export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Map the dealer's header row onto our field names.
 * Accepts several spellings per column because dealers will not rewrite
 * their existing export to match our documentation.
 */
const HEADER_ALIASES: Record<string, string[]> = {
  make: ["make", "brand", "manufacturer"],
  model: ["model"],
  variant: ["variant", "trim", "version"],
  year: ["year", "modelyear", "regyear", "model"],
  price: ["price", "pricepkr", "askingprice", "amount"],
  mileage: ["mileage", "mileagekm", "km", "kms", "driven"],
  city: ["city", "location"],
  registeredCity: ["registeredcity", "registeredin", "registration"],
  color: ["color", "colour"],
  assembly: ["assembly", "origin"],
  transmission: ["transmission", "gearbox"],
  fuel: ["fuel", "fueltype"],
  description: ["description", "details", "comments", "remarks"],
  imageUrls: ["images", "imageurls", "photos", "pictures"],
};

export function mapHeaders(header: string[]): Record<string, number> {
  const normalized = header.map(normalizeHeader);
  const out: Record<string, number> = {};

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    // Longest alias first so "modelyear" wins over "model" for the year column.
    const ordered = [...aliases].sort((a, b) => b.length - a.length);
    for (const alias of ordered) {
      const idx = normalized.indexOf(alias);
      if (idx !== -1 && !Object.values(out).includes(idx)) {
        out[field] = idx;
        break;
      }
    }
  }

  return out;
}
