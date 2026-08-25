"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  requestPasswordResetAction,
  type ForgotPasswordState,
} from "@/lib/auth/reset-actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<ForgotPasswordState, FormData>(
    requestPasswordResetAction,
    {},
  );

  if (state.sent) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="font-medium">Check your email</p>
        <p className="mt-1">
          If an account exists for that address, we sent a reset link. It is
          valid for 30 minutes and can be used once.
        </p>
        <Link href="/login" className="mt-3 inline-block font-medium text-blue-700 hover:underline">
          Return to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Account email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2.5 text-base"
        />
        {state.fieldErrors?.email && (
          <p className="mt-1 text-xs text-red-600">{state.fieldErrors.email}</p>
        )}
      </div>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-[#f7b500] px-4 py-2.5 font-bold text-[#151515] hover:bg-[#ffc62b] disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-blue-700 hover:underline">Back to sign in</Link>
      </p>
    </form>
  );
}
