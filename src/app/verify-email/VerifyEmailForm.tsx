"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  confirmEmailVerificationAction,
  type VerifyEmailState,
} from "@/lib/auth/verification-actions";

export function VerifyEmailForm({ token, next }: { token: string; next: string }) {
  const [state, action, pending] = useActionState<VerifyEmailState, FormData>(
    confirmEmailVerificationAction,
    {},
  );
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="next" value={next} />
      <p className="text-sm leading-6 text-slate-600">
        Confirm this address to activate your account. The verification link can
        be used once and expires after 24 hours.
      </p>
      {state.error && (
        <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}
      <button disabled={pending} className="w-full rounded bg-[#f7b500] px-4 py-2.5 font-bold text-[#151515] hover:bg-[#ffc62b] disabled:opacity-60">
        {pending ? "Verifying…" : "Verify email and continue"}
      </button>
      <p className="text-center text-sm">
        <Link href="/verify-email/resend" className="font-medium text-blue-700 hover:underline">
          Request a new verification link
        </Link>
      </p>
    </form>
  );
}
