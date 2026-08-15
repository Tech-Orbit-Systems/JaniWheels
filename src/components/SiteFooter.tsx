import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

const marketplaceLinks = [
  ["Cars", "/used-cars"],
  ["Bikes", "/used-bikes"],
  ["Auto Parts", "/auto-parts"],
  ["Verified Dealers", "/dealers"],
] as const;

const actionLinks = [
  ["Post an Ad", "/sell"],
  ["Vehicle Inspection", "/inspection"],
  ["My Ads", "/dashboard"],
  ["Dealer Registration", "/dealers/register"],
] as const;

export function SiteFooter({ siteName }: { siteName: string }) {
  return (
    <footer className="mt-20 border-t border-white/10 bg-[#101214] text-zinc-300">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <BrandLogo className="mb-5" />
          <p className="max-w-sm text-sm leading-6 text-zinc-400">
            Pakistan&apos;s automotive classified marketplace for cars, bikes
            and auto parts. Discover listings and contact sellers directly.
          </p>
        </div>

        <FooterColumn title="Marketplace" links={marketplaceLinks} />
        <FooterColumn title="Sell & services" links={actionLinks} />
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {siteName}. All rights reserved.</p>
          <p>
            Developed by{" "}
            <a
              href="https://techorbitsystems.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#f7b500] hover:text-[#ffc62b]"
            >
              Tech Orbit Systems
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <div>
      <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-white">
        {title}
      </h2>
      <ul className="grid gap-2.5 text-sm">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="transition hover:text-[#f7b500]">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
