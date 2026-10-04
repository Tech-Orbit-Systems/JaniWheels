"use client";
import { useActionState } from "react";
import { createRetentionHoldAction } from "@/lib/retention/admin-actions";
export function HoldForm() {
  const [state, action, pending] = useActionState(createRetentionHoldAction, {});
  const cls = "mt-1 block w-full rounded border border-slate-300 p-2";
  return <form action={action} className="mt-6 grid gap-4 rounded border bg-white p-5 sm:grid-cols-2">
    <label>Record type<select name="resource" className={cls}>{["account","listing","report","inspection","assistance","moderation"].map(r=><option key={r}>{r}</option>)}</select></label>
    <label>Record ID<input name="resourceId" type="number" min={1} required className={cls} /></label>
    <label>Reason<textarea name="reason" minLength={5} maxLength={1000} required className={cls} /></label>
    <label>Responsible person<input name="responsible" minLength={2} maxLength={160} required className={cls} /></label>
    {state.error && <p role="alert" className="text-red-700">{state.error}</p>}{state.success && <p role="status" className="text-green-800">{state.success}</p>}
    <button disabled={pending} className="rounded bg-blue-700 p-3 font-semibold text-white">Create hold</button>
  </form>;
}
