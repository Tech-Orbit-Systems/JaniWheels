import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  fromPaisa,
  gatewayTimestamp,
  toPaisa,
  type CallbackResult,
  type CheckoutForm,
  type CheckoutRequest,
  type PaymentDriver,
} from "./gateway";

/**
 * JazzCash Hosted Checkout (v2.0 pattern).
 *
 * Secure hash = HMAC-SHA256 over the integrity salt followed by every
 * non-empty `pp_*` field value, sorted by field name, joined with "&".
 * The salt is both the leading element and the HMAC key — that is JazzCash's
 * scheme, not a mistake.
 *
 * See the warning in gateway.ts: confirm field names against your merchant
 * portal's current integration guide before going live.
 */

const LIVE_URL =
  "https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform";
const SANDBOX_URL =
  "https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform";

function endpoint(): string {
  return process.env.JAZZCASH_MODE === "live" ? LIVE_URL : SANDBOX_URL;
}

function computeHash(fields: Record<string, string>, salt: string): string {
  const payload = Object.keys(fields)
    .filter((k) => k.startsWith("pp_") && fields[k] !== "")
    .sort()
    .map((k) => fields[k]);

  return createHmac("sha256", salt)
    .update([salt, ...payload].join("&"))
    .digest("hex")
    .toUpperCase();
}

export const jazzcash: PaymentDriver = {
  name: "jazzcash",

  isConfigured() {
    return Boolean(
      process.env.JAZZCASH_MERCHANT_ID &&
        process.env.JAZZCASH_PASSWORD &&
        process.env.JAZZCASH_INTEGRITY_SALT,
    );
  },

  buildCheckout(req: CheckoutRequest): CheckoutForm {
    const salt = process.env.JAZZCASH_INTEGRITY_SALT!;
    const now = new Date();
    // Expiry must be in the future or the gateway rejects the request
    // outright; one hour is comfortable for a wallet confirmation.
    const expiry = new Date(now.getTime() + 3_600_000);

    const fields: Record<string, string> = {
      pp_Version: "2.0",
      pp_TxnType: "MWALLET",
      pp_Language: "EN",
      pp_MerchantID: process.env.JAZZCASH_MERCHANT_ID!,
      pp_Password: process.env.JAZZCASH_PASSWORD!,
      pp_TxnRefNo: req.orderReference,
      pp_Amount: toPaisa(req.amountPkr),
      pp_TxnCurrency: "PKR",
      pp_TxnDateTime: gatewayTimestamp(now),
      pp_TxnExpiryDateTime: gatewayTimestamp(expiry),
      pp_BillReference: req.orderReference,
      pp_Description: req.description.slice(0, 100),
      pp_ReturnURL: req.returnUrl,
      ppmpf_1: req.customerPhone ?? "",
    };

    fields.pp_SecureHash = computeHash(fields, salt);

    return { action: endpoint(), method: "POST", fields };
  },

  verifyCallback(payload: Record<string, string>): CallbackResult {
    const salt = process.env.JAZZCASH_INTEGRITY_SALT;
    if (!salt) {
      return { ok: false, raw: payload, error: "Gateway not configured" };
    }

    const received = (payload.pp_SecureHash ?? "").toUpperCase();
    const { pp_SecureHash: _omit, ...rest } = payload;
    const expected = computeHash(rest, salt);

    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      // Either a misconfiguration or someone forging a success callback.
      // Both are the same decision: do not credit the order.
      return { ok: false, raw: payload, error: "Signature mismatch" };
    }

    // "000" is success; "121" is the common insufficient-balance decline.
    const success = payload.pp_ResponseCode === "000";

    return {
      ok: success,
      orderReference: payload.pp_TxnRefNo,
      gatewayRef: payload.pp_RetreivalReferenceNo || payload.pp_AuthCode,
      amountPkr: payload.pp_Amount ? fromPaisa(payload.pp_Amount) : undefined,
      raw: payload,
      error: success
        ? undefined
        : `${payload.pp_ResponseCode}: ${payload.pp_ResponseMessage ?? "declined"}`,
    };
  },
};
