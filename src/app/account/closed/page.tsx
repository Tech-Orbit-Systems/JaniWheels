import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "Account closed | JaniWheels", robots: { index: false, follow: false } };
export default function ClosedPage() {
  return <main className="mx-auto max-w-2xl px-4 py-12"><h1 className="text-2xl font-semibold">Account closed</h1><p className="mt-4 text-slate-700">Your public profile and ads are hidden, alerts are stopped and existing sign-ins are revoked. You can sign in within 30 days to restore your account. After that, personal data is removed according to our retention policy.</p><Link href="/login?next=/account/restore" className="mt-6 inline-block rounded bg-blue-700 px-5 py-3 font-semibold text-white">Sign in to restore</Link></main>;
}
