import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Payment failed",
  robots: { index: false, follow: false },
};

export default async function PaymentFailedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-slate-900">
        Payment didn&apos;t go through
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Nothing has been charged and your ad is unchanged.
      </p>

      {reason && (
        <p className="mt-4 rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
          {reason}
        </p>
      )}

      <div className="mt-6 flex justify-center gap-3">
        <Link
          href="/dashboard"
          className="rounded bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to my ads
        </Link>
      </div>

      <p className="mt-6 text-xs text-slate-500">
        If money left your account but the ad wasn&apos;t promoted, send us the
        order reference — it is on the payment confirmation SMS.
      </p>
    </main>
  );
}
