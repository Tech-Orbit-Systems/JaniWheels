import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

const marketplaceLinks = [
  ["Cars", "/used-cars"],
  ["Bikes", "/used-bikes"],
  ["Auto Parts", "/auto-parts"],
  ["Verified Dealers", "/dealers"],
] as const;

const actionLinks = [
  ["Post an Ad", "/post-ad"],
  ["Vehicle Inspection", "/inspection"],
  ["My Ads", "/dashboard"],
  ["Dealer Registration", "/dealers/register"],
] as const;

const socialLinks = [
  ["Facebook", "JaniWheels", "https://www.facebook.com/JaniWheels/"],
  ["Instagram", "@janiwheels2", "https://www.instagram.com/janiwheels2/"],
  ["TikTok", "JaniWheels", "https://vt.tiktok.com/ZSVYkMxT2/"],
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
          <div className="mt-5 flex flex-wrap gap-2" aria-label="JaniWheels social media">
            {socialLinks.map(([platform, handle, href]) => (
              <a
                key={platform}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${platform}: ${handle}`}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-semibold text-zinc-300 transition hover:border-[#f7b500]/60 hover:text-[#f7b500]"
              >
                <SocialIcon platform={platform} />
                {handle}
              </a>
            ))}
          </div>
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

function SocialIcon({ platform }: { platform: string }) {
  if (platform === "Instagram") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (platform === "TikTok") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M15.4 3c.4 2.2 1.7 3.6 3.6 3.8v3.1a8.2 8.2 0 0 1-3.5-1v6.2a6 6 0 1 1-5.2-5.9v3.2a2.9 2.9 0 1 0 2 2.7V3h3.1Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M14 8h3V4.3c-.5-.1-1.8-.3-3.4-.3C10.4 4 8 6 8 9.7V13H4v4h4v7h4v-7h4.4l.7-4H12V10c0-1.2.3-2 2-2Z" />
    </svg>
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
