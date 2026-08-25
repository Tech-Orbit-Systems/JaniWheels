import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Choose a new password | JaniWheels",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-md px-4 py-12">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">Choose a new password</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">Use at least 10 characters. Reset links expire after 30 minutes.</p>
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            This reset link is incomplete. <Link href="/forgot-password" className="font-medium text-blue-700 hover:underline">Request a new one</Link>.
          </div>
        )}
      </div>
    </main>
  );
}
