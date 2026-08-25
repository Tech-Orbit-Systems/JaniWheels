"use client";

import { useEffect, useState } from "react";
import { History, Trash2 } from "lucide-react";
import { ListingCard } from "@/components/ListingCard";
import type { SearchResultRow } from "@/lib/listings/search";
import {
  addRecentlyViewed,
  normalizeRecentlyViewed,
  RECENTLY_VIEWED_STORAGE_KEY,
} from "@/lib/listings/recently-viewed";

type RecentRow = SearchResultRow & { vertical: "car" | "bike" | "part" };

function readHistory(): number[] {
  try {
    return normalizeRecentlyViewed(JSON.parse(localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

function saveHistory(ids: number[]) {
  localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(ids));
}

export function RecentlyViewed({
  currentListingId,
  recordCurrent = false,
  limit = 4,
}: {
  currentListingId?: number;
  recordCurrent?: boolean;
  limit?: number;
}) {
  const [rows, setRows] = useState<RecentRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const stored = readHistory();
    const requested = stored.filter((id) => id !== currentListingId);

    async function load() {
      try {
        if (requested.length) {
          const response = await fetch(
            `/api/recently-viewed?ids=${encodeURIComponent(requested.join(","))}`,
            { cache: "no-store", signal: controller.signal },
          );
          if (response.ok) {
            const data = (await response.json()) as { rows?: RecentRow[] };
            const activeRows = Array.isArray(data.rows) ? data.rows : [];
            setRows(activeRows.slice(0, limit));
            const activeIds = activeRows.map((row) => row.id);
            saveHistory(
              recordCurrent && currentListingId
                ? addRecentlyViewed(activeIds, currentListingId)
                : normalizeRecentlyViewed(activeIds),
            );
          }
        } else if (recordCurrent && currentListingId) {
          saveHistory(addRecentlyViewed([], currentListingId));
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("recently viewed load failed", error);
        }
      } finally {
        if (!controller.signal.aborted) setLoaded(true);
      }
    }

    void load();
    return () => controller.abort();
  }, [currentListingId, limit, recordCurrent]);

  function clear() {
    localStorage.removeItem(RECENTLY_VIEWED_STORAGE_KEY);
    setRows([]);
  }

  if (!loaded || rows.length === 0) return null;

  return (
    <section className="mx-auto mt-16 w-full max-w-7xl px-4 sm:mt-20" aria-labelledby="recently-viewed-title">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.2em] text-[#a97700]">
            <History size={16} aria-hidden /> Your browsing history
          </p>
          <h2 id="recently-viewed-title" className="text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-3xl">
            Recently viewed
          </h2>
        </div>
        <button type="button" onClick={clear} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-zinc-500 hover:text-red-700">
          <Trash2 size={16} aria-hidden /> Clear
        </button>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((row) => <ListingCard key={row.id} row={row} vertical={row.vertical} />)}
      </ul>
    </section>
  );
}
