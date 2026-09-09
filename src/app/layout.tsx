import type { Metadata } from "next";
import "./globals.css";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "JaniWheels";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Buy & Sell Used Cars, Bikes and Auto Parts in Pakistan`,
    template: `%s`,
  },
  description:
    "Buy and sell used cars, bikes and auto parts in Pakistan. Browse ads by city and budget, and contact sellers directly.",
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

        <a
          href="#main-content"
          className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-[#f7b500] px-4 py-2 font-bold text-[#151515] shadow-lg transition-transform focus:translate-y-0"
        >
          Skip to main content
        </a>

        <SiteHeader />

        <div id="main-content">{children}</div>

        <SiteFooter siteName={SITE_NAME} />
      </body>
    </html>
  );
}
