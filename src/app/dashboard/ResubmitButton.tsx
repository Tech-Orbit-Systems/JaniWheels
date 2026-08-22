"use client";

import { useState, useTransition } from "react";
import { resubmitRejectedListingAction } from "@/lib/listings/sell-actions";

export function ResubmitButton({ listingId }: { listingId: number }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => {
          const result = await resubmitRejectedListingAction(listingId);
          setMessage(result.notice ?? result.error ?? "Unable to resubmit.");
        })}
        className="font-medium text-blue-700 hover:underline disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Resubmit for review"}
      </button>
      {message && <p className="mt-1 text-xs text-slate-600">{message}</p>}
    </div>
  );
}
