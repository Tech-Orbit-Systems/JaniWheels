"use client";

import { useState, useTransition } from "react";
import { setDealerVerificationAction } from "@/lib/dealers/actions";

export function DealerVerificationActions({
  dealerId,
  verified,
}: {
  dealerId: number;
  verified: boolean;
}) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (decision: "verify" | "revoke") => {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await setDealerVerificationAction(dealerId, decision, reason);
      if (!result.ok) return setError(result.message);
      setMessage(result.message);
    });
  };

  return (
    <div className="flex min-w-64 flex-col gap-2">
      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={500}
        rows={2}
        placeholder={verified ? "Revocation reason (required)" : "Verification note (optional)"}
        className="rounded border border-slate-300 px-2 py-1 text-xs"
      />
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      {message && <p role="status" className="text-xs text-emerald-700">{message}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(verified ? "revoke" : "verify")}
        className={`rounded px-3 py-2 text-xs font-medium text-white disabled:opacity-60 ${verified ? "bg-red-700 hover:bg-red-800" : "bg-emerald-700 hover:bg-emerald-800"}`}
      >
        {pending ? "Saving…" : verified ? "Revoke verification" : "Verify dealer"}
      </button>
    </div>
  );
}
