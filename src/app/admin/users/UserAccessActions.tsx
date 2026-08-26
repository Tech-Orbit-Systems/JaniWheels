"use client";

import { useState, useTransition } from "react";
import { setUserBanAction } from "@/lib/trust/actions";

export function UserAccessActions({ userId, banned }: { userId: number; banned: boolean }) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const decision = banned ? "unban" : "ban";

  return <div className="flex max-w-xs flex-col gap-2">
    <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder={`${banned ? "Restoration" : "Ban"} reason (required)`} className="rounded-lg border border-slate-300 px-3 py-2 text-xs" />
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    {message && <p role="status" className="text-xs text-emerald-700">{message}</p>}
    <button type="button" disabled={pending} onClick={() => startTransition(async () => {
      setError(null); setMessage(null);
      const result = await setUserBanAction(userId, decision, reason);
      if (result.ok) setMessage(result.message); else setError(result.message);
    })} className={`rounded-lg px-3 py-2 text-xs font-bold text-white disabled:opacity-60 ${banned ? "bg-emerald-700 hover:bg-emerald-800" : "bg-red-700 hover:bg-red-800"}`}>
      {pending ? "Saving…" : banned ? "Restore access" : "Ban user"}
    </button>
  </div>;
}
