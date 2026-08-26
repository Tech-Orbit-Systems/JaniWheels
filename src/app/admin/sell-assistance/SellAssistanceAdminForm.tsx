"use client";

import { useActionState } from "react";
import { updateSellAssistanceAction, type SellAssistanceAdminState } from "@/lib/trust/sell-assistance-actions";
import { allowedSellAssistanceTransitions, sellAssistanceStatusLabel, type SellAssistanceStatus } from "@/lib/trust/sell-assistance-policy";

export function SellAssistanceAdminForm({ requestId, status }: { requestId: number; status: SellAssistanceStatus }) {
  const [state, action, pending] = useActionState<SellAssistanceAdminState, FormData>(updateSellAssistanceAction, {});
  const options = [status, ...allowedSellAssistanceTransitions(status)];
  return <form action={action} className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-3 lg:grid-cols-2">
    <input type="hidden" name="requestId" value={requestId} />
    <label className="text-xs font-semibold text-slate-700">Status<select name="status" defaultValue={status} className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm">{options.map((option) => <option key={option} value={option}>{sellAssistanceStatusLabel(option)}</option>)}</select></label>
    <label className="text-xs font-semibold text-slate-700">Customer update<textarea name="customerMessage" rows={3} maxLength={1000} placeholder="Visible in the customer's dashboard" className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
    <label className="text-xs font-semibold text-slate-700 lg:col-span-2">Internal note<textarea name="internalNote" rows={2} maxLength={2000} placeholder="Staff-only call notes or buyer follow-up context" className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
    {state.error && <p role="alert" className="text-sm text-red-700 lg:col-span-2">{state.error}</p>}{state.ok && <p role="status" className="text-sm text-emerald-700">Update saved and audited.</p>}
    <button disabled={pending} className="justify-self-start rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : "Save update"}</button>
  </form>;
}
