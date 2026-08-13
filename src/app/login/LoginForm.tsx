"use client";

import { useActionState } from "react";
import {
  requestCodeAction,
  verifyCodeAction,
  type AuthState,
} from "@/lib/auth/actions";

/**
 * Two-step phone login.
 *
 * Deliberately not an email/password form. In this market email-first signup
 * is a conversion cliff, and the phone number is the thing buyers will
 * actually call — verifying it at signup is what makes a listing usable.
 */
export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    async (prev, formData) =>
      prev.step === "code" && formData.get("code")
        ? verifyCodeAction(prev, formData)
        : requestCodeAction(prev, formData),
    { step: "phone", next },
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      {state.step === "phone" ? (
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-slate-700"
          >
            Mobile number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            autoFocus
            placeholder="0300 1234567"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2.5 text-base"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            We&apos;ll text you a 6-digit code.
          </p>
        </div>
      ) : (
        <div>
          <input type="hidden" name="phone" value={state.phone} />
          <label
            htmlFor="code"
            className="block text-sm font-medium text-slate-700"
          >
            Enter the code sent to {state.phone}
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            placeholder="123456"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2.5 text-center text-2xl tracking-[0.4em]"
          />
          {state.devCode && (
            <p className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
              Dev mode — your code is <strong>{state.devCode}</strong>
            </p>
          )}
        </div>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending
          ? "Please wait…"
          : state.step === "phone"
            ? "Send code"
            : "Verify and continue"}
      </button>
    </form>
  );
}
