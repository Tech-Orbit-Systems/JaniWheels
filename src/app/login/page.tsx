import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string; reset?: string }>;
}) {
  const user = await getCurrentUser();
  const { next, mode: rawMode, reset } = await searchParams;
  const target = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
  const mode = rawMode === "register" ? "register" : "sign_in";

  if (user) redirect(target);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-12">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">
          {mode === "register" ? "Create your account" : "Sign in"}
        </h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">
          {mode === "register"
            ? "Post and manage your classified ads."
            : "Use your mobile number and password."}
        </p>
        {reset === "success" && (
          <p className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Your password has been changed. Sign in with the new password.
          </p>
        )}
        <LoginForm next={target} mode={mode} />
      </div>
    </main>
  );
}
