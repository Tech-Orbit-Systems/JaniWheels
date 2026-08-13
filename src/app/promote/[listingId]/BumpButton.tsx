"use client";

import { useState, useTransition } from "react";
import { bumpListingAction } from "@/lib/listings/bump-actions";

export function BumpButton({ listingId }: { listingId: number }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={pending || message !== null}
        onClick={() =>
          startTransition(async () => {
            const r = await bumpListingAction(listingId);
            setMessage(
              r.ok
                ? `Bumped. ${r.remaining} left.`
                : (r.error ?? "Could not bump."),
            );
          })
        }
        className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Bumping…" : "Bump to top"}
      </button>
      {message && <span className="text-sm text-emerald-900">{message}</span>}
    </div>
  );
}
