import "server-only";
import { NextResponse } from "next/server";
import type { CheckoutForm, GatewayName } from "./gateway";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/**
 * Self-submitting gateway form.
 *
 * PK gateways expect a POST of signed fields rather than a redirect with
 * query parameters, so there is no URL to send the user to — the browser has
 * to submit a form.
 *
 * ─── SECURITY: pp_Password IS VISIBLE IN PAGE SOURCE ───────────────────────
 * JazzCash's hosted-checkout spec requires `pp_Password` as a form field, so
 * it necessarily reaches the browser and anyone can read it with view-source.
 * This is how their documented Page Redirection flow works, not a bug in this
 * code — but it is a real exposure and you should know about it:
 *
 *   - `pp_Password` is a per-merchant API password, NOT your merchant portal
 *     login. Confirm that with JazzCash for your account before going live.
 *   - The integrity salt is the thing that actually authenticates a request,
 *     and it is never sent to the browser — only the derived hash is.
 *   - If your account supports the server-to-server API flow, prefer it: it
 *     keeps every credential server-side. Use this browser-form flow only if
 *     that is unavailable.
 *   - Rotate the password if it is ever reused anywhere else.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Note the CSP in next.config.ts must allowlist the gateway origin under
 * `form-action`, or the browser blocks this submit with no server-side error.
 */
export function renderGatewayForm(
  checkout: CheckoutForm,
  gateway: GatewayName,
  reference: string,
): NextResponse {
  const inputs = Object.entries(checkout.fields)
    .map(
      ([k, v]) =>
        `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`,
    )
    .join("\n    ");

  const label = gateway === "jazzcash" ? "JazzCash" : "Easypaisa";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Redirecting to payment…</title>
<meta name="robots" content="noindex,nofollow"></head>
<body style="font-family:system-ui,sans-serif;padding:2rem;text-align:center">
  <p>Taking you to ${escapeHtml(label)}…</p>
  <p style="color:#64748b;font-size:.875rem">Order ${escapeHtml(reference)}</p>
  <form id="pay" method="${checkout.method}" action="${escapeHtml(checkout.action)}">
    ${inputs}
    <noscript><button type="submit">Continue to payment</button></noscript>
  </form>
  <script>document.getElementById('pay').submit();</script>
</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
