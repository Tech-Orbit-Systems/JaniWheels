import Link from "next/link";
import { Menu } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { BrandLogo } from "@/components/BrandLogo";

const navigation = [
  { href: "/used-cars", label: "Used Cars" },
  { href: "/used-bikes", label: "Bikes" },
  { href: "/auto-parts", label: "Auto Parts" },
  { href: "/dealers", label: "Dealers" },
  { href: "/inspection", label: "Inspection" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#101214]/95 text-white shadow-lg shadow-black/10 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-3 px-4">
        <Link href="/" aria-label="JaniWheels home" className="shrink-0">
          <BrandLogo />
        </Link>

        <nav
          aria-label="Primary navigation"
          className="mx-auto hidden items-center gap-1 lg:flex"
        >
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7b500]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-3 lg:flex">
          <AccountMenu />
          <PostAdLink />
        </div>

        <div className="ml-auto flex items-center gap-2 lg:hidden">
          <PostAdLink compact />
          <details className="group relative">
            <summary className="flex size-11 cursor-pointer list-none items-center justify-center rounded-lg border border-white/15 text-white hover:bg-white/10 [&::-webkit-details-marker]:hidden">
              <span className="sr-only">Open navigation</span>
              <Menu aria-hidden size={21} />
            </summary>
            <div className="absolute right-0 top-[calc(100%+0.6rem)] w-64 overflow-hidden rounded-xl border border-zinc-700 bg-[#17191c] p-2 shadow-2xl">
              <nav aria-label="Mobile navigation" className="grid">
                {navigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-3 text-sm font-medium text-zinc-200 hover:bg-white/7"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-2 border-t border-white/10 px-3 py-2">
                <AccountMenu />
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

function PostAdLink({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/sell"
      className={`inline-flex items-center justify-center rounded-lg bg-[#f7b500] font-bold text-[#151515] transition hover:bg-[#ffc62b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
        compact ? "px-3 py-2 text-xs sm:text-sm" : "px-4 py-2.5 text-sm"
      }`}
    >
      Post an Ad
    </Link>
  );
}
