"use client";

import { useState, useTransition } from "react";
import { markSoldAction } from "@/lib/listings/sell-actions";

/**
 * Marking sold is worth making easy, not hard.
 *
 * The temptation is to bury it — a live ad looks like inventory. But stale
 * "still available?" calls are the fastest way to make sellers stop posting,
 * and a sold listing is the single most valuable row you own: it is a real
 * transacted price, which is what `price_snapshots` is built from.
 */
export function MarkSoldButton({ listingId }: { listingId: number }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-slate-500 underline hover:text-slate-800"
      >
        Mark as sold
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <span className="text-slate-600">Sold?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => markSoldAction(listingId))}
        className="rounded bg-slate-800 px-2 py-1 font-medium text-white disabled:opacity-60"
      >
        {pending ? "…" : "Yes"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-slate-500 underline"
      >
        Cancel
      </button>
    </span>
  );
}
