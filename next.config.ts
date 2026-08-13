import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,

  /**
   * `next build` and `next dev` both write to .next, so running a build while
   * the dev server is up corrupts it — the dev server starts throwing
   * MODULE_NOT_FOUND and serving 404s for its own CSS, which looks exactly
   * like a broken Tailwind config and sends you debugging the wrong thing.
   *
   * Set NEXT_DIST_DIR to build into a separate directory instead:
   *   NEXT_DIST_DIR=.next-build npm run build
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",

  images: {
    // AVIF first — meaningful bandwidth win on the mid-range Android traffic
    // that will make up most of this site's sessions.
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 414, 640, 768, 1024, 1280],
    imageSizes: [64, 96, 128, 256, 384],
    remotePatterns: [
      { protocol: "https", hostname: "imagedelivery.net" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
    ],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          // A real CSP from day one. Retrofitting one onto a site that has
          // grown 80 inline scripts is the reason most classifieds sites
          // never ship it at all.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              /**
               * Next's dev server compiles with eval for React Refresh, so
               * without 'unsafe-eval' NOTHING hydrates in development — every
               * client component silently renders as dead HTML with only a
               * CSP EvalError in the console to explain it. Production keeps
               * the strict policy.
               */
              [
                "script-src 'self' 'unsafe-inline'",
                process.env.NODE_ENV === "development" ? "'unsafe-eval'" : "",
                "https://www.googletagmanager.com",
              ]
                .filter(Boolean)
                .join(" "),
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://www.google-analytics.com",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              // Payment checkout posts a signed form to the gateway's hosted
              // page. With a bare `form-action 'self'` the browser silently
              // blocks that submit and checkout dies with no server-side
              // error to find.
              [
                "form-action 'self'",
                "https://payments.jazzcash.com.pk",
                "https://sandbox.jazzcash.com.pk",
                "https://easypay.easypaisa.com.pk",
                "https://easypaystg.easypaisa.com.pk",
              ].join(" "),
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default config;
