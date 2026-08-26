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

  if (state.registeredEmail) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="font-semibold">Check your email</p>
        <p className="mt-1">
          We sent a verification link to {state.registeredEmail}. Verify it to
          activate your account and continue.
        </p>
        <Link href="/verify-email/resend" className="mt-3 inline-block font-medium text-blue-700 hover:underline">
          Request another link
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href={`/api/auth/google/start?next=${encodeURIComponent(next)}`}
        className="flex w-full items-center justify-center gap-3 rounded border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
      >
        <GoogleIcon />
        Continue with Google
      </Link>

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          or use email
        </span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

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
        {registering ? (
        <Field
          id="email"
          label="Email address"
          type="email"
          autoComplete="email"
          error={state.fieldErrors?.email}
        />
        ) : (
          <Field
            id="identifier"
            label="Email or mobile number"
            type="text"
            autoComplete="username"
            placeholder="name@example.com or 0300 1234567"
            error={state.fieldErrors?.identifier}
          />
        )}
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete={registering ? "new-password" : "current-password"}
          error={state.fieldErrors?.password}
        />
        {!registering && (
          <div className="-mt-2 flex justify-between gap-3 text-sm">
            <Link href="/verify-email/resend" className="font-medium text-blue-700 hover:underline">
              Resend verification
            </Link>
            <Link href="/forgot-password" className="font-medium text-blue-700 hover:underline">
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
              ? "Create account with email"
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
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.4 2.9-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.6A10.1 10.1 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.9V7.5H3.1a10.1 10.1 0 0 0 0 9.1L6.5 14Z" />
      <path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.9 1.5l2.9-2.8A9.7 9.7 0 0 0 12 2a10.1 10.1 0 0 0-8.9 5.5l3.4 2.6A5.9 5.9 0 0 1 12 6Z" />
    </svg>
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
