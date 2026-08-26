"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  resendEmailVerificationAction,
  type ResendVerificationState,
} from "@/lib/auth/verification-actions";

export function ResendVerificationForm() {
  const [state, action, pending] = useActionState<ResendVerificationState, FormData>(
    resendEmailVerificationAction,
    {},
  );
  if (state.sent) {
    return (
      <div className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        If an unverified account exists for that address, a new link has been sent.
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email address</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="mt-1 w-full rounded border border-slate-300 px-3 py-2.5 text-base" />
        {state.fieldErrors?.email && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.email}</p>}
      </div>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="w-full rounded bg-[#f7b500] px-4 py-2.5 font-bold text-[#151515] disabled:opacity-60">
        {pending ? "Sending…" : "Send verification link"}
      </button>
      <p className="text-center text-sm"><Link href="/login" className="font-medium text-blue-700 hover:underline">Back to sign in</Link></p>
    </form>
  );
}
