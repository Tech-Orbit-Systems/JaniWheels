import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionAccount } from "@/lib/auth/session";
import { AccountRestore } from "@/components/AccountClosure";
export const metadata: Metadata = { title: "Restore account | JaniWheels", robots: { index: false, follow: false } };
export default async function RestorePage() {
  const account = await getSessionAccount();
  if (!account) redirect("/login?next=/account/restore");
  if (!account.closedAt) redirect("/dashboard/profile");
  const deadline = new Date(account.closedAt.getTime() + 30 * 86400_000);
  return <main className="mx-auto max-w-2xl px-4 py-12"><h1 className="text-2xl font-semibold">Restore your account</h1>
    <p className="mt-4 text-slate-700">Your account is closed. Your current sign-in only allows account recovery. The recovery deadline is {deadline.toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })}.</p>
    {deadline.getTime()>Date.now() ? <><p className="mt-3 text-slate-700">Restoring brings back eligible ads and saved-search preferences. Expired ads and moderation decisions remain in effect.</p><AccountRestore /></> : <p className="mt-4 text-red-700">The 30-day recovery period has ended.</p>}
    <Link className="mt-6 inline-block text-blue-700 underline" href="/privacy">Read the retention policy</Link>
  </main>;
}
