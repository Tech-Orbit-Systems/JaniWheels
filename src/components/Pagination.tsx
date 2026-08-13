import Link from "next/link";
import { buildPath, type FacetState } from "@/lib/seo/facets";

/**
 * Real <a> links, not a client-side pager.
 *
 * Infinite scroll on an indexable listing page hides everything past the
 * first screen from a crawler. Whatever the fashion, paginated links are how
 * listings 26 through 10,000 get discovered.
 */

function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const out: (number | "gap")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) out.push("gap");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("gap");
  out.push(total);

  return out;
}

export function Pagination({
  state,
  page,
  pageCount,
}: {
  state: FacetState;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;

  const href = (p: number) => buildPath({ ...state, page: p });

  return (
    <nav
      aria-label="Pagination"
      className="mt-8 flex items-center justify-center gap-1"
    >
      {page > 1 && (
        <Link
          href={href(page - 1)}
          rel="prev"
          className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Previous
        </Link>
      )}

      {pageWindow(page, pageCount).map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="px-2 text-slate-400">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={
              p === page
                ? "rounded border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
                : "rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            }
          >
            {p}
          </Link>
        ),
      )}

      {page < pageCount && (
        <Link
          href={href(page + 1)}
          rel="next"
          className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Next
        </Link>
      )}
    </nav>
  );
}
