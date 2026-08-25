import type { Metadata } from "next";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot password | JaniWheels",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-12">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">Reset your password</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">
          Enter the email registered with your JaniWheels account.
        </p>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
