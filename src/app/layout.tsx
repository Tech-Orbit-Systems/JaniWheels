import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
import { AccountMenu } from "@/components/AccountMenu";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "AutoBazaar";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Buy & Sell Used Cars, Bikes and Auto Parts in Pakistan`,
    template: `%s`,
  },
  description:
    "Buy and sell used cars, bikes and auto parts in Pakistan. See how every price compares to the market before you call the seller.",
  openGraph: { siteName: SITE_NAME, locale: "en_PK", type: "website" },
};

/**
 * One shared layout for every device.
 *
 * Explicitly NOT the two-frontend split the incumbent runs (server-rendered
 * desktop, separate React SPA for mobile). That split means every feature
 * ships twice and the two drift apart. Responsive CSS costs a fraction of
 * that and stays consistent by construction.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd()),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }}
        />

        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-3">
            <Link href="/" className="text-lg font-bold text-slate-900">
              {SITE_NAME}
            </Link>

            <nav className="ml-2 hidden items-center gap-4 text-sm text-slate-600 sm:flex">
              <Link href="/used-cars" className="hover:text-slate-900">
                Used Cars
              </Link>
              <Link href="/used-bikes" className="hover:text-slate-900">
                Bikes
              </Link>
              <Link href="/auto-parts" className="hover:text-slate-900">
                Auto Parts
              </Link>
              <Link href="/dealers" className="hover:text-slate-900">
                Dealers
              </Link>
              <Link href="/price-calculator" className="hover:text-slate-900">
                Price Calculator
              </Link>
              <Link href="/inspection" className="hover:text-slate-900">
                Inspection
              </Link>
            </nav>

            <div className="ml-auto flex items-center gap-3">
              <AccountMenu />
              <Link
                href="/sell"
                className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Post an Ad
              </Link>
            </div>
          </div>
        </header>

        {children}

        <footer className="mt-16 border-t border-slate-200 bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 text-sm text-slate-500">
            <p>
              © {new Date().getFullYear()} {SITE_NAME}
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
