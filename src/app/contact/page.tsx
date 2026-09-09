import type { Metadata } from "next";
import { Instagram, Mail, MessageCircle, Phone, ShieldAlert } from "lucide-react";
import { ContentPage, ContentSection, InlineLink } from "@/components/ContentPage";
import { abs } from "@/lib/seo/jsonld";

export const metadata: Metadata = { title: "Contact JaniWheels", description: "Contact JaniWheels for marketplace support, safety concerns and account assistance.", alternates: { canonical: abs("/contact") } };

export default function ContactPage() {
  return <ContentPage eyebrow="Contact" title="How can we help?" intro="Need help with an ad, your account or a service request? Call, email or send us a WhatsApp message. Never send passwords, verification codes or full payment-card details.">
    <section className="grid gap-4 sm:grid-cols-2">
      <a href="mailto:info@janiwheels.com" className="rounded-xl border border-slate-200 bg-white p-6 transition hover:border-amber-400"><Mail className="text-amber-600" aria-hidden /><h2 className="mt-4 text-lg font-bold text-slate-950">Email us</h2><p className="mt-2 text-sm leading-6"><strong>info@janiwheels.com</strong></p></a>
      <a href="tel:+923333294075" className="rounded-xl border border-slate-200 bg-white p-6 transition hover:border-amber-400"><Phone className="text-amber-600" aria-hidden /><h2 className="mt-4 text-lg font-bold text-slate-950">Call us</h2><p className="mt-2 text-sm leading-6"><strong>0333 3294075</strong></p></a>
      <a href="https://wa.me/923333294075" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-200 bg-white p-6 transition hover:border-amber-400"><MessageCircle className="text-amber-600" aria-hidden /><h2 className="mt-4 text-lg font-bold text-slate-950">WhatsApp</h2><p className="mt-2 text-sm leading-6">Message <strong>0333 3294075</strong> on WhatsApp.</p></a>
      <a href="https://www.instagram.com/janiwheels2/" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-200 bg-white p-6 transition hover:border-amber-400"><Instagram className="text-amber-600" aria-hidden /><h2 className="mt-4 text-lg font-bold text-slate-950">Instagram</h2><p className="mt-2 text-sm leading-6">Message <strong>@janiwheels2</strong> for general enquiries.</p></a>
      <a href="https://www.facebook.com/JaniWheels/" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-200 bg-white p-6 transition hover:border-amber-400 sm:col-span-2"><MessageCircle className="text-amber-600" aria-hidden /><h2 className="mt-4 text-lg font-bold text-slate-950">Facebook</h2><p className="mt-2 text-sm leading-6">Reach the official JaniWheels Facebook page for general support.</p></a>
    </section>
    <ContentSection title="Listing or safety concern"><p>Use the Report option on the relevant listing so our moderation team receives the correct listing reference. For broader concerns, read our <InlineLink href="/report-concern">reporting guidance</InlineLink>.</p></ContentSection>
    <ContentSection title="Before contacting us"><p className="flex gap-3"><ShieldAlert className="mt-1 shrink-0 text-amber-600" aria-hidden />Include the listing URL or account context and a short description of the issue. Do not publish private documents or sensitive personal information in listing descriptions.</p></ContentSection>
  </ContentPage>;
}
