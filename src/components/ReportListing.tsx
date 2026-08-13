"use client";

import { useActionState, useState } from "react";
import { reportListingAction, type ReportState } from "@/lib/trust/actions";

const REASONS = [
  { value: "sold", label: "Already sold" },
  { value: "fraud", label: "Looks like a scam" },
  { value: "wrong_price", label: "Price is wrong or bait" },
  { value: "wrong_category", label: "Wrong category" },
  { value: "duplicate", label: "Duplicate listing" },
  { value: "offensive", label: "Offensive content" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Something else" },
];

/**
 * Reporting is deliberately low-friction and does not require an account.
 *
 * The people best placed to spot a scam are buyers who have just been
 * scammed by it, and they will not create a login to tell you. Abuse is
 * handled by one-report-per-person and a high auto-hide threshold, not by
 * making reporting hard.
 */
export function ReportListing({ listingId }: { listingId: number }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ReportState, FormData>(
    reportListingAction,
    {},
  );

  if (state.ok) {
    return (
      <p className="mt-4 text-xs text-emerald-700">
        Thanks — we&apos;ll take a look.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 text-xs text-slate-500 underline hover:text-slate-700"
      >
        Report this ad
      </button>
    );
  }

  return (
    <form action={action} className="mt-4 rounded border border-slate-200 p-3">
      <input type="hidden" name="listingId" value={listingId} />

      <label className="block text-xs font-medium text-slate-700">
        What&apos;s wrong with this ad?
      </label>
      <select
        name="reason"
        required
        defaultValue=""
        className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="" disabled>
          Choose a reason
        </option>
        {REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>

      <textarea
        name="comment"
        rows={2}
        maxLength={1000}
        placeholder="Anything else we should know? (optional)"
        className="mt-2 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />

      {state.error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {state.error}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send report"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-slate-500 underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
