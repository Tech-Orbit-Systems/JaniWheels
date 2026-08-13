"use client";

import { useState, useTransition } from "react";
import { moderateAction } from "@/lib/trust/actions";

export function ModerationActions({ listingId }: { listingId: number }) {
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return <span className="text-xs text-slate-500">{done}</span>;
  }

  const run = (action: "approve" | "remove") =>
    startTransition(async () => {
      const reason =
        action === "remove"
          ? (globalThis.prompt("Reason for removal (kept on the audit log):") ??
            undefined)
          : undefined;
      // A cancelled prompt means the moderator changed their mind.
      if (action === "remove" && reason === undefined) return;

      await moderateAction(listingId, action, reason);
      setDone(action === "approve" ? "Approved" : "Removed");
    });

  return (
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run("approve")}
        className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run("remove")}
        className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
      >
        Remove
      </button>
    </div>
  );
}
