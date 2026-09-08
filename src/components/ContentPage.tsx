import Link from "next/link";
import type { ReactNode } from "react";

export function ContentPage({
  eyebrow,
  title,
  intro,
  children,
  updated,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
  updated?: string;
}) {
  return (
    <main>
      <section className="bg-[#101214] px-4 py-12 text-white sm:py-16">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#f7b500]">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300 sm:text-lg">
            {intro}
          </p>
          {updated ? <p className="mt-5 text-sm text-zinc-400">Last updated: {updated}</p> : null}
        </div>
      </section>
      <div className="mx-auto grid max-w-4xl gap-8 px-4 py-10 text-slate-700 sm:py-14">
        {children}
      </div>
    </main>
  );
}

export function ContentSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-xl font-bold text-slate-950 sm:text-2xl">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 sm:text-base">{children}</div>
    </section>
  );
}

export function ContentList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-[#d29400]">{children}</ul>;
}

export function InlineLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-link font-semibold text-amber-700 underline decoration-amber-300 underline-offset-4 hover:text-amber-900">{children}</Link>;
}
