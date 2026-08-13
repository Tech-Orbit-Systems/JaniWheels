import "server-only";

/**
 * PAYMENT GATEWAYS
 * ============================================================================
 *
 * Pakistan-first: JazzCash and Easypaisa mobile wallets, not cards. Card
 * penetration is low and Stripe does not serve PK merchants, so a Stripe-
 * shaped abstraction would be the wrong shape entirely.
 *
 * Both gateways work the same way:
 *   1. You POST a signed form to their hosted checkout page.
 *   2. The customer authorises in their wallet app.
 *   3. The gateway POSTs a signed result back to your callback URL.
 *
 * ─── READ THIS BEFORE GOING LIVE ───────────────────────────────────────────
 * The exact parameter names, hash input ordering and endpoints below are
 * implemented from the published integration patterns, but every PK gateway
 * revises these between merchant-portal versions and they differ per account
 * (v1.1 vs v2.0 JazzCash, Easypaisa MA vs OTC flows).
 *
 * Verify every field against YOUR merchant documentation in sandbox before
 * taking real money. What must not change is the security shape:
 *
 *   - The callback is the ONLY source of truth for payment success. Never
 *     mark an order paid from a browser redirect — that is user-controlled.
 *   - Always verify the response hash before trusting any field.
 *   - Always re-check the amount against your own order record. A gateway
 *     response saying "paid PKR 1" for a PKR 2500 package must be rejected.
 * ───────────────────────────────────────────────────────────────────────────
 */

export type GatewayName = "jazzcash" | "easypaisa";

export interface CheckoutRequest {
  orderReference: string;
  amountPkr: number;
  description: string;
  customerPhone?: string;
  customerEmail?: string;
  returnUrl: string;
}

/**
 * Gateways expect a self-submitting HTML form POST rather than a redirect,
 * so the driver returns the target and fields instead of a URL.
 */
export interface CheckoutForm {
  action: string;
  method: "POST";
  fields: Record<string, string>;
}

export interface CallbackResult {
  ok: boolean;
  orderReference?: string;
  gatewayRef?: string;
  amountPkr?: number;
  /** Raw payload, persisted verbatim for dispute resolution. */
  raw: Record<string, string>;
  error?: string;
}

export interface PaymentDriver {
  name: GatewayName;
  isConfigured(): boolean;
  buildCheckout(req: CheckoutRequest): CheckoutForm;
  verifyCallback(payload: Record<string, string>): CallbackResult;
}

/** Gateways quote amounts in paisa (1 PKR = 100 paisa). */
export function toPaisa(pkr: number): string {
  return String(Math.round(pkr * 100));
}

export function fromPaisa(paisa: string): number {
  return Math.round(Number(paisa) / 100);
}

/** yyyyMMddHHmmss, in PKT — both gateways reject UTC timestamps. */
export function gatewayTimestamp(date = new Date()): string {
  const pkt = new Date(date.getTime() + 5 * 3600 * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${pkt.getUTCFullYear()}${p(pkt.getUTCMonth() + 1)}${p(pkt.getUTCDate())}` +
    `${p(pkt.getUTCHours())}${p(pkt.getUTCMinutes())}${p(pkt.getUTCSeconds())}`
  );
}
