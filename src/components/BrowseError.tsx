"use client";

import Link from "next/link";

export function BrowseError({
  label,
  href,
  reset,
}: {
  label: string;
  href: string;
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10" role="alert">
        <h1 className="text-2xl font-bold text-slate-900">{label} listings are temporarily unavailable</h1>
        <p className="mt-3 text-slate-600">We could not load these listings right now. Please try again.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-[#f7b500] px-5 py-3 font-semibold text-[#151515] hover:bg-[#e5a700]"
          >
            Try again
          </button>
          <Link href={href} className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50">
            Clear filters
          </Link>
        </div>
      </div>
    </main>
  );
}
