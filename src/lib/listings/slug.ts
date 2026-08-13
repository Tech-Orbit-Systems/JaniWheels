import slugify from "slugify";

/**
 * Detail-page URLs.
 *
 *   /used-cars/toyota-corolla-altis-grande-2020-for-sale-in-lahore-11755169
 *              └────────────────── slug ──────────────────┘ └── id ──┘
 *
 * The trailing id is the only thing that identifies the row. That means the
 * slug is free to change (a seller edits the title, you improve the format)
 * without ever breaking a link — the route reads the id and 301s to the
 * current slug if it has drifted. Sites that key detail pages on the slug
 * alone either freeze their titles forever or accumulate 404s.
 */

export interface SlugParts {
  makeName?: string | null;
  modelName?: string | null;
  variantName?: string | null;
  year?: number | null;
  cityName?: string | null;
}

export function buildListingSlug(parts: SlugParts): string {
  const words = [
    parts.makeName,
    parts.modelName,
    parts.variantName,
    parts.year ? String(parts.year) : null,
    "for sale in",
    parts.cityName,
  ]
    .filter(Boolean)
    .join(" ");

  return slugify(words, { lower: true, strict: true, trim: true });
}

const BASE_BY_VERTICAL = {
  car: "/used-cars",
  bike: "/used-bikes",
  part: "/auto-parts",
} as const;

export function buildListingPath(
  vertical: "car" | "bike" | "part",
  slug: string,
  id: number,
): string {
  return `${BASE_BY_VERTICAL[vertical]}/${slug}-${id}`;
}

/**
 * Pull the id off the end of a detail slug.
 * Returns null when the segment has no trailing id, which the route treats
 * as a 404 rather than guessing.
 */
export function parseListingSlug(
  segment: string,
): { slug: string; id: number } | null {
  const m = /^(.*)-(\d+)$/.exec(segment);
  if (!m) return null;
  const id = Number(m[2]);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return { slug: m[1], id };
}
