import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { sqlClient } from "@/db";
import { reviewRetentionHoldAction } from "@/lib/retention/admin-actions";
import { HoldForm } from "./HoldForm";
export const metadata: Metadata = { title: "Retention holds | JaniWheels", robots: { index: false, follow: false } };
export default async function RetentionPage() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) redirect("/login?next=/admin/retention");
  const holds = await sqlClient`SELECT * FROM retention_holds WHERE released_at IS NULL ORDER BY reviewed_at LIMIT 100`;
  const [{ overdue }] = await sqlClient`SELECT count(*)::int overdue FROM retention_holds WHERE released_at IS NULL AND reviewed_at<NOW()-INTERVAL '90 days'`;
  return <main className="mx-auto max-w-5xl px-4 py-8"><h1 className="text-2xl font-semibold">Retention holds</h1>
    <p className="mt-3 text-slate-700">Hold only necessary evidence. Review every 90 days; an overdue review does not automatically release evidence. Open listing reports also protect related evidence.</p>
    <p className="mt-3 font-semibold">{overdue} overdue reviews</p><HoldForm />
    <ul className="mt-6 space-y-4">{holds.map(h=><li key={h.id} className="rounded border bg-white p-4"><h2 className="font-semibold">{h.resource} #{h.resource_id}</h2><p>{h.reason}</p><p className="text-sm text-slate-700">Responsible: {h.responsible} · Last review: {new Date(h.reviewed_at).toLocaleDateString("en-PK")}</p>
      <form action={reviewRetentionHoldAction} className="mt-3 flex flex-wrap gap-3"><input type="hidden" name="holdId" value={h.id} /><button className="rounded border px-3 py-2">Record review</button><button name="release" value="yes" className="rounded border border-red-300 px-3 py-2 text-red-700">Release hold</button></form></li>)}</ul>
  </main>;
}
