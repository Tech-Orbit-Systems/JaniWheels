import type { Metadata } from "next";
import { CarFront, Handshake, ShieldCheck } from "lucide-react";
import { ContentPage, ContentSection } from "@/components/ContentPage";
import { abs } from "@/lib/seo/jsonld";

export const metadata: Metadata = { title: "About JaniWheels | Pakistan Automotive Marketplace", description: "Learn how JaniWheels helps people across Pakistan discover and advertise cars, bikes and auto parts.", alternates: { canonical: abs("/about") } };

export default function AboutPage() {
  const values = [[CarFront, "Built for automotive classifieds", "Search by make, model, price and city to narrow down the ads you want to see."], [Handshake, "Direct buyer and seller contact", "JaniWheels helps people discover listings and connect; it does not act as the buyer, seller or payment processor."], [ShieldCheck, "Check before you buy", "Read the seller profile, ask about the vehicle and report suspicious ads. Our team reviews dealer verification requests."]] as const;
  return <ContentPage eyebrow="About us" title="A clearer way to buy and sell vehicles in Pakistan" intro="Looking for a used car, a bike for your daily commute or a replacement part? JaniWheels brings ads from sellers across Pakistan into one place.">
    <section className="grid gap-4 sm:grid-cols-3">{values.map(([Icon, title, copy]) => <article key={title} className="rounded-xl border border-slate-200 bg-white p-5"><Icon className="text-amber-600" aria-hidden /><h2 className="mt-4 font-bold text-slate-950">{title}</h2><p className="mt-2 text-sm leading-6">{copy}</p></article>)}</section>
    <ContentSection title="What JaniWheels does"><p>People can browse or advertise used cars, bikes and auto parts, compare suitable vehicle listings, save searches and contact sellers directly. Dealers can maintain a public storefront, while our team can review reports and verification requests.</p></ContentSection>
    <ContentSection title="Before you agree to a sale"><p>JaniWheels provides listing and communication tools. We do not own advertised vehicles, guarantee their condition, set prices, collect transaction payments, provide financing or manage transfer and delivery. Buyers and sellers remain responsible for their decisions and transaction.</p></ContentSection>
  </ContentPage>;
}
