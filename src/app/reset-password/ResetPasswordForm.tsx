"use client";

import { useActionState } from "react";
import {
  resetPasswordAction,
  type ResetPasswordState,
} from "@/lib/auth/reset-actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetPasswordState, FormData>(
    resetPasswordAction,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <PasswordField id="password" label="New password" autoComplete="new-password" error={state.fieldErrors?.password} />
      <PasswordField id="confirmPassword" label="Confirm new password" autoComplete="new-password" error={state.fieldErrors?.confirmPassword} />
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending || !token}
        className="w-full rounded bg-[#f7b500] px-4 py-2.5 font-bold text-[#151515] hover:bg-[#ffc62b] disabled:opacity-60"
      >
        {pending ? "Updating…" : "Set new password"}
      </button>
    </form>
  );
}

function PasswordField({ id, label, error, autoComplete }: { id: string; label: string; error?: string; autoComplete: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">{label}</label>
      <input id={id} name={id} type="password" required minLength={10} maxLength={128} autoComplete={autoComplete} className="mt-1 w-full rounded border border-slate-300 px-3 py-2.5 text-base" />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
