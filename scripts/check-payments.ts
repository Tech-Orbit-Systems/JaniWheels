/**
 * Payment invariant checks:  npx tsx scripts/check-payments.ts
 *
 * Runs against the live dev database and cleans up after itself.
 *
 * These assert the three things that cost real money when they break:
 *   - a forged callback cannot credit an order
 *   - a replayed callback cannot credit an order twice
 *   - a callback claiming the wrong amount cannot credit an order at all
 *
 * Every one of these is a silent failure in production: nobody files a bug
 * saying "I received more than I paid for".
 */

import "dotenv/config";
import { createCipheriv, createHmac } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import {
  orders,
  listingPromotions,
  adPackages,
  dealerPlans,
  dealerSubscriptions,
} from "../src/db/schema/commerce";
import { listings } from "../src/db/schema/listings";
import { users, dealers } from "../src/db/schema/users";
import {
  createOrder,
  createSubscriptionOrder,
  applyPaidOrder,
  consumeBump,
} from "../src/lib/payments/orders";
import { jazzcash } from "../src/lib/payments/jazzcash";
import { easypaisa } from "../src/lib/payments/easypaisa";

process.env.JAZZCASH_MERCHANT_ID ||= "TESTMERCHANT";
process.env.JAZZCASH_PASSWORD ||= "testpass";
process.env.JAZZCASH_INTEGRITY_SALT ||= "TESTSALT123456";

let passed = 0;
const failures: string[] = [];

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`${name}\n    expected: ${e}\n    actual:   ${a}`);
}

/**
 * Sign a payload the way Easypaisa would.
 *
 * Mirrors the driver's scheme deliberately rather than importing its private
 * helper: if someone changes the driver's hashing, this stays as the
 * independent statement of what the gateway expects and the round-trip test
 * fails — which is the point of having it.
 */
function easypaisaSign(fields: Record<string, string>): string {
  const key = process.env.EASYPAISA_HASH_KEY!;
  const body = Object.keys(fields)
    .filter((k) => fields[k] !== "" && !/^hash(Request|Key|Response)$/.test(k))
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("&");

  const raw = Buffer.from(key, "utf8");
  const size = raw.length >= 32 ? 32 : raw.length >= 24 ? 24 : 16;
  const algorithm =
    size === 32 ? "aes-256-ecb" : size === 24 ? "aes-192-ecb" : "aes-128-ecb";
  const keyBuf = Buffer.alloc(size);
  raw.copy(keyBuf, 0, 0, Math.min(size, raw.length));

  const cipher = createCipheriv(algorithm, keyBuf, null);
  cipher.setAutoPadding(true);
  return Buffer.concat([
    cipher.update(Buffer.from(body, "utf8")),
    cipher.final(),
  ]).toString("base64");
}

/** Re-sign a payload the way the gateway would, for the happy path. */
function signed(fields: Record<string, string>): Record<string, string> {
  const salt = process.env.JAZZCASH_INTEGRITY_SALT!;
  const payload = Object.keys(fields)
    .filter((k) => k.startsWith("pp_") && fields[k] !== "")
    .sort()
    .map((k) => fields[k]);
  const hash = createHmac("sha256", salt)
    .update([salt, ...payload].join("&"))
    .digest("hex")
    .toUpperCase();
  return { ...fields, pp_SecureHash: hash };
}

async function main() {
  console.log("Payment invariant checks\n" + "=".repeat(40));

  // ---- fixtures ---------------------------------------------------------
  // The user must be the listing's OWNER — consumeBump enforces that, so
  // picking an arbitrary user and an arbitrary listing tests nothing except
  // the ownership guard.
  //
  // `ORDER BY id` matters: LIMIT 1 without it is non-deterministic in
  // Postgres, so the bump assertions would silently test a different listing
  // between runs and fail whenever that listing happened to carry leftover
  // promotions.
  const [listing] = await db
    .select({ id: listings.id, sellerId: listings.sellerId })
    .from(listings)
    .where(eq(listings.status, "active"))
    .orderBy(listings.id)
    .limit(1);
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, listing?.sellerId ?? 0))
    .limit(1);
  const [pkg] = await db
    .select()
    .from(adPackages)
    .where(eq(adPackages.slug, "featured-7"))
    .limit(1);

  if (!user || !listing || !pkg) {
    console.error("Missing fixtures — run db:seed and the demo seed first.");
    process.exit(1);
  }

  const createdOrderIds: number[] = [];

  // Start from a clean slate: any promotion left on this listing by a real
  // user (or an earlier interrupted run) would throw off the bump counts.
  await db
    .delete(listingPromotions)
    .where(eq(listingPromotions.listingId, listing.id));

  // ---- 1. signature verification ----------------------------------------
  const forged = {
    pp_TxnRefNo: "JW-2026-0000001",
    pp_Amount: "150000",
    pp_ResponseCode: "000",
    pp_SecureHash: "DEADBEEF",
  };
  check(
    "forged callback is rejected",
    jazzcash.verifyCallback(forged).ok,
    false,
  );
  check(
    "forged callback reports why",
    jazzcash.verifyCallback(forged).error,
    "Signature mismatch",
  );

  // ---- 2. happy path -----------------------------------------------------
  const { order } = await createOrder({
    userId: user.id,
    listingId: listing.id,
    adPackageId: pkg.id,
  });
  createdOrderIds.push(order.id);

  check("order starts pending", order.status, "pending");
  check("order price comes from the package, not the client", order.amountPkr, pkg.pricePkr);

  const good = signed({
    pp_TxnRefNo: order.reference,
    pp_Amount: String(pkg.pricePkr * 100),
    pp_ResponseCode: "000",
    pp_ResponseMessage: "Success",
    pp_RetreivalReferenceNo: "RRN123456",
  });

  const verified = jazzcash.verifyCallback(good);
  check("valid signature verifies", verified.ok, true);
  check("amount decoded from paisa", verified.amountPkr, pkg.pricePkr);

  const applied = await applyPaidOrder("jazzcash", verified);
  check("payment applies", applied.ok && !applied.alreadyApplied, true);

  const [afterPay] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, order.id));
  check("order marked paid", afterPay.status, "paid");

  const promos = await db
    .select()
    .from(listingPromotions)
    .where(eq(listingPromotions.orderId, order.id));
  check("exactly one promotion granted", promos.length, 1);
  check("bump credits granted", promos[0]?.bumpsTotal, pkg.bumpCount);
  check(
    "featured window set",
    promos[0]?.featuredUntil !== null,
    pkg.featuredDays > 0,
  );

  // ---- 3. replay / idempotence ------------------------------------------
  const replay = await applyPaidOrder("jazzcash", verified);
  check("replayed callback is a no-op", replay.ok && replay.alreadyApplied, true);

  const promosAfterReplay = await db
    .select()
    .from(listingPromotions)
    .where(eq(listingPromotions.orderId, order.id));
  check(
    "replay does not grant a second promotion",
    promosAfterReplay.length,
    1,
  );

  // ---- 4. amount tampering ----------------------------------------------
  const { order: order2 } = await createOrder({
    userId: user.id,
    listingId: listing.id,
    adPackageId: pkg.id,
  });
  createdOrderIds.push(order2.id);

  // Correctly signed, but for one rupee.
  const underpaid = jazzcash.verifyCallback(
    signed({
      pp_TxnRefNo: order2.reference,
      pp_Amount: "100",
      pp_ResponseCode: "000",
      pp_RetreivalReferenceNo: "RRN999",
    }),
  );
  check("underpayment has a valid signature", underpaid.ok, true);

  const tampered = await applyPaidOrder("jazzcash", underpaid);
  check("underpayment is rejected", tampered.ok, false);
  check(
    "underpayment reports amount mismatch",
    tampered.ok === false ? tampered.error : null,
    "Amount mismatch",
  );

  const [afterTamper] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, order2.id));
  check("underpaid order marked failed", afterTamper.status, "failed");

  // ---- 5. declines -------------------------------------------------------
  const { order: order3 } = await createOrder({
    userId: user.id,
    listingId: listing.id,
    adPackageId: pkg.id,
  });
  createdOrderIds.push(order3.id);

  const declined = jazzcash.verifyCallback(
    signed({
      pp_TxnRefNo: order3.reference,
      pp_Amount: String(pkg.pricePkr * 100),
      pp_ResponseCode: "121",
      pp_ResponseMessage: "Insufficient balance",
    }),
  );
  check("decline code is not success", declined.ok, false);
  const declinedApply = await applyPaidOrder("jazzcash", declined);
  check("declined payment grants nothing", declinedApply.ok, false);

  // ---- 6. bump quota -----------------------------------------------------
  const first = await consumeBump(listing.id, user.id);
  check("bump succeeds while credits remain", first.ok, true);
  check("bump decrements the counter", first.remaining, pkg.bumpCount - 1);

  let remaining = first.remaining ?? 0;
  while (remaining > 0) {
    const r = await consumeBump(listing.id, user.id);
    remaining = r.remaining ?? 0;
  }
  const exhausted = await consumeBump(listing.id, user.id);
  check("bump is refused once exhausted", exhausted.ok, false);

  const notOwner = await consumeBump(listing.id, user.id + 99_999);
  check("bump refuses a non-owner", notOwner.ok, false);

  // ---- 7. Easypaisa driver ----------------------------------------------
  // Same invariants as JazzCash, asserted separately because it is a
  // different signing scheme (AES-ECB, not HMAC) and amounts are in RUPEES
  // rather than paisa. This driver shipped untested and had a forgery hole.
  process.env.EASYPAISA_STORE_ID ||= "12345";
  process.env.EASYPAISA_HASH_KEY ||= "TESTHASHKEY12345";

  const epCheckout = easypaisa.buildCheckout({
    orderReference: "JW-2026-EPTEST",
    amountPkr: 1500,
    description: "Test",
    returnUrl: "https://example.com/cb",
  });

  check(
    "easypaisa quotes rupees with decimals, not paisa",
    epCheckout.fields.amount,
    "1500.00",
  );
  check("easypaisa signs the request", Boolean(epCheckout.fields.hashRequest), true);
  check(
    "easypaisa hash is not the raw key",
    epCheckout.fields.hashRequest !== process.env.EASYPAISA_HASH_KEY,
    true,
  );

  // THE hole: an unsigned callback must never be trusted.
  const epUnsigned = easypaisa.verifyCallback({
    orderRefNum: "JW-2026-EPTEST",
    status: "0000",
    transactionAmount: "1500",
  });
  check("easypaisa rejects an UNSIGNED callback", epUnsigned.ok, false);
  check(
    "easypaisa says why it rejected",
    epUnsigned.error,
    "Callback is not signed",
  );

  const epForged = easypaisa.verifyCallback({
    orderRefNum: "JW-2026-EPTEST",
    status: "0000",
    transactionAmount: "1500",
    hashResponse: "bm90LWEtcmVhbC1oYXNo",
  });
  check("easypaisa rejects a forged signature", epForged.ok, false);
  check("easypaisa forged reports mismatch", epForged.error, "Signature mismatch");

  // Round-trip: sign a payload with the driver's own scheme and verify it.
  const epPayload: Record<string, string> = {
    orderRefNum: "JW-2026-EPTEST",
    status: "0000",
    transactionAmount: "1500",
    transactionId: "EP123456",
  };
  const epValid = easypaisa.verifyCallback({
    ...epPayload,
    hashResponse: easypaisaSign(epPayload),
  });
  check("easypaisa accepts a correctly signed callback", epValid.ok, true);
  check("easypaisa reads the order reference", epValid.orderReference, "JW-2026-EPTEST");
  check("easypaisa reads rupees as rupees", epValid.amountPkr, 1500);

  const epDeclined = easypaisa.verifyCallback({
    ...epPayload,
    status: "0001",
    hashResponse: easypaisaSign({ ...epPayload, status: "0001" }),
  });
  check("easypaisa treats a non-zero status as declined", epDeclined.ok, false);

  // ---- 8. dealer subscriptions -------------------------------------------
  const [dealerRow] = await db
    .select({ id: dealers.id, userId: dealers.userId })
    .from(dealers)
    .orderBy(dealers.id)
    .limit(1);

  if (dealerRow) {
    const [plan] = await db
      .select()
      .from(dealerPlans)
      .where(eq(dealerPlans.slug, "showroom"))
      .limit(1);

    await db
      .delete(dealerSubscriptions)
      .where(eq(dealerSubscriptions.dealerId, dealerRow.id));

    const sub1 = await createSubscriptionOrder({
      userId: dealerRow.userId,
      dealerPlanId: plan.id,
    });
    createdOrderIds.push(sub1.order.id);

    check(
      "subscription price comes from the plan",
      sub1.order.amountPkr,
      plan.monthlyPricePkr,
    );

    const paid1 = jazzcash.verifyCallback(
      signed({
        pp_TxnRefNo: sub1.order.reference,
        pp_Amount: String(plan.monthlyPricePkr * 100),
        pp_ResponseCode: "000",
        pp_RetreivalReferenceNo: "SUB1",
      }),
    );
    await applyPaidOrder("jazzcash", paid1);

    const [afterFirst] = await db
      .select({ endsAt: dealerSubscriptions.endsAt })
      .from(dealerSubscriptions)
      .where(eq(dealerSubscriptions.dealerId, dealerRow.id));

    check("subscription is created on payment", Boolean(afterFirst), true);

    const firstEnd = afterFirst.endsAt.getTime();
    const daysFromNow = Math.round((firstEnd - Date.now()) / 86_400_000);
    check("first term runs 30 days", daysFromNow, 30);

    // Renew EARLY. The new term must extend from the existing expiry, not
    // from today — renewing three days early otherwise silently costs the
    // dealer three days, which is the kind of thing that is noticed once and
    // never trusted again.
    const sub2 = await createSubscriptionOrder({
      userId: dealerRow.userId,
      dealerPlanId: plan.id,
    });
    createdOrderIds.push(sub2.order.id);

    await applyPaidOrder(
      "jazzcash",
      jazzcash.verifyCallback(
        signed({
          pp_TxnRefNo: sub2.order.reference,
          pp_Amount: String(plan.monthlyPricePkr * 100),
          pp_ResponseCode: "000",
          pp_RetreivalReferenceNo: "SUB2",
        }),
      ),
    );

    const [afterRenew] = await db
      .select({ endsAt: dealerSubscriptions.endsAt })
      .from(dealerSubscriptions)
      .where(eq(dealerSubscriptions.dealerId, dealerRow.id));

    const renewedDays = Math.round(
      (afterRenew.endsAt.getTime() - Date.now()) / 86_400_000,
    );
    check("early renewal extends rather than resets", renewedDays, 60);

    const subCount = await db
      .select({ id: dealerSubscriptions.id })
      .from(dealerSubscriptions)
      .where(eq(dealerSubscriptions.dealerId, dealerRow.id));
    check("renewal does not create a duplicate row", subCount.length, 1);

    await db
      .delete(dealerSubscriptions)
      .where(eq(dealerSubscriptions.dealerId, dealerRow.id));
  } else {
    failures.push("subscription checks skipped — no dealer fixture");
  }

  // ---- cleanup -----------------------------------------------------------
  await db
    .delete(listingPromotions)
    .where(inArray(listingPromotions.orderId, createdOrderIds));
  await db.delete(orders).where(inArray(orders.id, createdOrderIds));

  console.log(`\n  ${passed} passed, ${failures.length} failed\n`);
  for (const f of failures) console.error(`  FAIL  ${f}\n`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
