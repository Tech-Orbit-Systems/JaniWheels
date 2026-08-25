export const RECENTLY_VIEWED_STORAGE_KEY = "janiwheels.recently-viewed.v1";
export const RECENTLY_VIEWED_LIMIT = 20;

/** Browser storage is user-controlled, so normalize it before every use. */
export function normalizeRecentlyViewed(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  const ids: number[] = [];
  const seen = new Set<number>();
  for (const candidate of value) {
    const id = typeof candidate === "number" ? candidate : Number(candidate);
    if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length === RECENTLY_VIEWED_LIMIT) break;
  }
  return ids;
}

export function addRecentlyViewed(ids: number[], listingId: number): number[] {
  return normalizeRecentlyViewed([listingId, ...ids.filter((id) => id !== listingId)]);
}

export function parseRecentlyViewedQuery(raw: string | null): number[] {
  return normalizeRecentlyViewed((raw ?? "").split(","));
}
