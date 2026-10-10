"use client";

import { useRouter } from "next/navigation";
import { buildPath, type FacetState } from "@/lib/seo/facets";

const OPTIONS = [
  { value: "recent", label: "Recently updated" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "year_desc", label: "Model year: newest" },
  { value: "year_asc", label: "Model year: oldest" },
  { value: "mileage_asc", label: "Mileage: lowest" },
] as const;

/**
 * The only client component on the search page.
 *
 * Sorting navigates rather than fetching, so the sorted view is a real URL
 * a user can share — and `decideIndexation` marks it noindex so it never
 * competes with the unsorted page it duplicates.
 */
export function SortSelect({ state }: { state: FacetState }) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      <span className="hidden sm:inline">Sort by</span>
      <select
        aria-label="Sort by"
        value={state.sort ?? "recent"}
        onChange={(e) =>
          router.push(buildPath({ ...state, sort: e.target.value, page: 1 }))
        }
        className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
