import type { Metadata } from "next";
import { ResendVerificationForm } from "./ResendVerificationForm";

export const metadata: Metadata = {
  title: "Resend verification | JaniWheels",
  robots: { index: false, follow: false },
};

export default function ResendVerificationPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-12">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">Resend verification email</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">Enter the address used to create your account.</p>
        <ResendVerificationForm />
      </div>
    </main>
  );
}
