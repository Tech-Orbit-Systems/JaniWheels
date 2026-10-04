"use client";
import { useActionState } from "react";
import { closeAccountAction, restoreAccountAction } from "@/lib/account/closure-actions";

export function AccountClosure() {
  const [state, action, pending] = useActionState(closeAccountAction, {});
  return <section className="mt-8 rounded-xl border border-red-200 bg-white p-6">
    <h2 className="text-lg font-semibold text-slate-900">Close account</h2>
    <p className="mt-2 text-sm text-slate-700">Your public profile and ads will be hidden immediately, alerts will stop and all devices will be signed out. Sign in within 30 days to restore the account. After that, personal data is removed under our retention policy; necessary complaint evidence may be held.</p>
    <form action={action} className="mt-4 space-y-3">
      <label className="block text-sm font-medium text-slate-900">Type CLOSE to confirm<input name="confirmation" required pattern="CLOSE" autoComplete="off" className="mt-1 block w-full rounded border border-slate-300 p-3" /></label>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="rounded bg-red-700 px-4 py-3 font-semibold text-white disabled:opacity-60">{pending ? "Closing…" : "Close my account"}</button>
    </form>
  </section>;
}

export function AccountRestore() {
  const [state, action, pending] = useActionState(restoreAccountAction, {});
  return <form action={action} className="mt-6 space-y-3">
    {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
    <button disabled={pending} className="rounded bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-60">{pending ? "Restoring…" : "Restore my account"}</button>
  </form>;
}
