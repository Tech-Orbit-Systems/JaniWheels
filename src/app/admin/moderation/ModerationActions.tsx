"use client";

import { useState, useTransition } from "react";
import { moderateAction, setAdminListingStateAction } from "@/lib/trust/actions";

export function ModerationActions({ listingId, status = "pending_review" }: { listingId: number; status?: string }) {
  const [done, setDone] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return <span className="text-xs text-slate-500">{done}</span>;
  }

  const run = (action: "approve" | "reject") =>
    startTransition(async () => {
      setError(null);
      const result = await moderateAction(listingId, action, reason);
      if (!result.ok) return setError(result.message);
      setDone(result.message);
    });

  const setState = (decision: "flag" | "reinstate" | "remove") =>
    startTransition(async () => {
      setError(null);
      const result = await setAdminListingStateAction(listingId, decision, reason);
      if (!result.ok) return setError(result.message);
      setDone(result.message);
    });

  return (
    <div className="flex max-w-xs flex-col gap-2">
      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Rejection reason (required to reject)"
        rows={2}
        className="rounded border border-slate-300 px-2 py-1 text-xs"
      />
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      <div className="flex shrink-0 gap-2">
      {status === "pending_review" && <button
        type="button"
        disabled={pending}
        onClick={() => run("approve")}
        className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        Approve
      </button>}
      {status === "pending_review" && <button
        type="button"
        disabled={pending}
        onClick={() => run("reject")}
        className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
      >
        Reject
      </button>}
      {status === "active" && <button type="button" disabled={pending} onClick={() => setState("flag")} className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60">Flag / hide</button>}
      {status !== "active" && status !== "removed" && <button type="button" disabled={pending} onClick={() => setState("reinstate")} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60">Reinstate</button>}
      {status !== "removed" && <button type="button" disabled={pending} onClick={() => setState("remove")} className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-60">Remove</button>}
      </div>
    </div>
  );
}
