import "server-only";
import { createCipheriv, timingSafeEqual } from "node:crypto";
import {
  type CallbackResult,
  type CheckoutForm,
  type CheckoutRequest,
  type PaymentDriver,
} from "./gateway";

/**
 * Easypaisa Hosted Checkout.
 *
 * Easypaisa signs with AES-128-ECB over the sorted `key=value&` parameter
 * string, base64-encoded — not an HMAC. It is a weaker scheme than
 * JazzCash's (ECB leaks structure and provides no integrity guarantee on its
 * own), which is exactly why `applyPaidOrder` re-validates the amount against
 * our own order record rather than trusting the callback's figure.
 *
 * Amounts here are in RUPEES with two decimals, unlike JazzCash's paisa.
 * Getting that wrong bills the customer 100x. See the warning in gateway.ts.
 */

const LIVE_URL = "https://easypay.easypaisa.com.pk/easypay/Index.jsf";
const SANDBOX_URL = "https://easypaystg.easypaisa.com.pk/easypay/Index.jsf";

function endpoint(): string {
  return process.env.EASYPAISA_MODE === "live" ? LIVE_URL : SANDBOX_URL;
}

/** Fields that carry the signature itself and must never be part of its input. */
const SIGNATURE_FIELDS = new Set(["hashRequest", "hashKey", "hashResponse"]);

function computeHash(fields: Record<string, string>, key: string): string {
  const payload = Object.keys(fields)
    .filter((k) => fields[k] !== "" && !SIGNATURE_FIELDS.has(k))
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("&");

  /**
   * Easypaisa issues 16- or 24-byte hash keys depending on the account, which
   * select AES-128 or AES-192. Forcing everything into a 16-byte buffer
   * silently truncates a 24-byte key and produces a hash the gateway will
   * never match — with no error to explain why every callback fails.
   */
  const raw = Buffer.from(key, "utf8");
  const size = raw.length >= 32 ? 32 : raw.length >= 24 ? 24 : 16;
  const algorithm =
    size === 32 ? "aes-256-ecb" : size === 24 ? "aes-192-ecb" : "aes-128-ecb";

  const keyBuf = Buffer.alloc(size);
  raw.copy(keyBuf, 0, 0, Math.min(size, raw.length));

  const cipher = createCipheriv(algorithm, keyBuf, null);
  cipher.setAutoPadding(true);

  return Buffer.concat([
    cipher.update(Buffer.from(payload, "utf8")),
    cipher.final(),
  ]).toString("base64");
}

export const easypaisa: PaymentDriver = {
  name: "easypaisa",

  isConfigured() {
    return Boolean(
      process.env.EASYPAISA_STORE_ID && process.env.EASYPAISA_HASH_KEY,
    );
  },

  buildCheckout(req: CheckoutRequest): CheckoutForm {
    const key = process.env.EASYPAISA_HASH_KEY!;
    const expiry = new Date(Date.now() + 3_600_000);
    const p = (n: number) => String(n).padStart(2, "0");

    const fields: Record<string, string> = {
      storeId: process.env.EASYPAISA_STORE_ID!,
      orderRefNum: req.orderReference,
      // Rupees with two decimals — NOT paisa.
      amount: req.amountPkr.toFixed(2),
      postBackURL: req.returnUrl,
      // yyyyMMdd HHmmss
      expiryDate:
        `${expiry.getFullYear()}${p(expiry.getMonth() + 1)}${p(expiry.getDate())} ` +
        `${p(expiry.getHours())}${p(expiry.getMinutes())}${p(expiry.getSeconds())}`,
      autoRedirect: "1",
      paymentMethod: "MA_PAYMENT_METHOD",
      emailAddr: req.customerEmail ?? "",
      mobileNum: req.customerPhone ?? "",
    };

    fields.hashRequest = computeHash(fields, key);

    return { action: endpoint(), method: "POST", fields };
  },

  verifyCallback(payload: Record<string, string>): CallbackResult {
    const key = process.env.EASYPAISA_HASH_KEY;
    if (!key) {
      return { ok: false, raw: payload, error: "Gateway not configured" };
    }

    const received =
      payload.hashResponse ?? payload.hashRequest ?? payload.hashKey ?? "";

    /**
     * An UNSIGNED callback is rejected, not trusted.
     *
     * Treating a missing signature as "nothing to verify" and falling through
     * to the status check is a forgery hole: anyone who can reach this public
     * endpoint POSTs `status=0000` with no hash and gets an order marked paid.
     * Absence of proof is not proof.
     */
    if (!received) {
      return { ok: false, raw: payload, error: "Callback is not signed" };
    }

    const expected = computeHash(payload, key);
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, raw: payload, error: "Signature mismatch" };
    }

    const success = payload.status === "0000" || payload.status === "0";

    return {
      ok: success,
      orderReference: payload.orderRefNumber ?? payload.orderRefNum,
      gatewayRef: payload.transactionId ?? payload.paymentToken,
      amountPkr: payload.transactionAmount
        ? Math.round(Number(payload.transactionAmount))
        : undefined,
      raw: payload,
      error: success
        ? undefined
        : `${payload.status}: ${payload.desc ?? "declined"}`,
    };
  },
};
