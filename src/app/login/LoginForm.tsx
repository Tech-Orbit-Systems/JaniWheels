"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  authenticateAction,
  type AuthMode,
  type AuthState,
} from "@/lib/auth/actions";

export function LoginForm({
  next,
  mode,
}: {
  next: string;
  mode: AuthMode;
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    authenticateAction,
    { mode, next },
  );
  const registering = mode === "register";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="mode" value={mode} />

      {registering && (
        <Field
          id="name"
          label="Full name"
          type="text"
          autoComplete="name"
          error={state.fieldErrors?.name}
        />
      )}
      {registering && (
        <Field
          id="email"
          label="Email address"
          type="email"
          autoComplete="email"
          error={state.fieldErrors?.email}
        />
      )}
      <Field
        id="phone"
        label="Mobile number"
        type="tel"
        autoComplete="tel"
        placeholder="0300 1234567"
        error={state.fieldErrors?.phone}
      />
      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete={registering ? "new-password" : "current-password"}
        error={state.fieldErrors?.password}
      />
      {!registering && (
        <div className="-mt-2 text-right">
          <Link href="/forgot-password" className="text-sm font-medium text-blue-700 hover:underline">
            Forgot password?
          </Link>
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
          : registering
            ? "Create account"
            : "Sign in"}
      </button>

      <p className="text-center text-sm text-slate-600">
        {registering ? "Already have an account?" : "New to JaniWheels?"}{" "}
        <Link
          href={`/login?mode=${registering ? "sign_in" : "register"}&next=${encodeURIComponent(next)}`}
          className="font-medium text-blue-700 hover:underline"
        >
          {registering ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  ...input
}: {
  id: string;
  label: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        name={id}
        required
        {...input}
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2.5 text-base"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
