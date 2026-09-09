import type { Metadata } from "next";
import { asc, desc, eq } from "drizzle-orm";
import { CheckCircle2, ClipboardCheck, Headphones, Megaphone } from "lucide-react";
import { db } from "@/db";
import { cities } from "@/db/schema/geo";
import { makes } from "@/db/schema/taxonomy";
import { abs } from "@/lib/seo/jsonld";
import { SellAssistanceForm } from "./SellAssistanceForm";

export const metadata: Metadata = { title: "Sell My Car Assistance | JaniWheels", description: "Request hands-on help preparing and managing your car sale on JaniWheels.", alternates: { canonical: abs("/sell-my-car") } };

export default async function SellMyCarPage() {
  const [cityRows, makeRows] = await Promise.all([
    db.select({ id: cities.id, name: cities.name }).from(cities).orderBy(desc(cities.popularity), asc(cities.name)),
    db.select({ id: makes.id, name: makes.name }).from(makes).where(eq(makes.vertical, "car")).orderBy(desc(makes.popularity), asc(makes.name)),
  ]);
  const steps = [
    [ClipboardCheck, "Share your car details", "Tell us about the vehicle, documents, condition and your selling timeline."],
    [Headphones, "Team review and call", "A JaniWheels team member reviews the request and confirms what assistance is available."],
    [Megaphone, "Ad preparation and follow-up", "We can coordinate the information needed to prepare the ad and record buyer follow-up progress."],
    [CheckCircle2, "Track the outcome", "Check your dashboard for updates from our team until your request is closed."],
  ] as const;
  return <main>
    <section className="bg-[#101214] px-4 py-12 text-white"><div className="mx-auto max-w-5xl"><p className="text-sm font-bold uppercase tracking-[0.18em] text-[#f7b500]">JaniWheels seller support</p><h1 className="mt-3 max-w-3xl text-3xl font-black sm:text-5xl">Sell your car with less hassle</h1><p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">Need help with your car ad? Share the details below. Our team will call to discuss the ad and follow up with you.</p></div></section>
    <section className="mx-auto max-w-5xl px-4 py-10"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{steps.map(([Icon, title, copy], index) => <article key={title} className="rounded-xl border border-slate-200 bg-white p-5"><span className="flex size-10 items-center justify-center rounded-full bg-[#f7b500]/15 font-bold text-amber-700"><Icon size={20} /></span><p className="mt-4 text-xs font-bold text-slate-400">STEP {index + 1}</p><h2 className="mt-1 font-bold text-slate-950">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p></article>)}</div>
      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_2fr]"><aside className="rounded-xl bg-slate-100 p-6"><h2 className="text-lg font-bold text-slate-950">What this service includes</h2><ul className="mt-4 space-y-3 text-sm text-slate-700">{["Help collecting your car details", "JaniWheels team follow-up", "Ad preparation progress", "Buyer follow-up status tracking", "A record of progress on your request", "Customer updates in your dashboard"].map((item) => <li key={item} className="flex gap-2"><CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-700" />{item}</li>)}</ul><h3 className="mt-7 font-bold text-slate-950">What we cannot promise</h3><p className="mt-2 text-sm leading-6 text-slate-600">Automatic valuation, guaranteed sale, vehicle purchase, inspection scheduling, payments and ownership transfer are not part of this request.</p></aside><section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-7"><SellAssistanceForm cities={cityRows} makes={makeRows} /></section></div>
    </section>
  </main>;
}
