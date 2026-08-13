import { NextResponse } from "next/server";
import { getDriver, type GatewayName } from "@/lib/payments";
import { applyPaidOrder } from "@/lib/payments/orders";
import { db } from "@/db";
import { listings } from "@/db/schema/listings";
import { eq } from "drizzle-orm";
import { buildListingPath } from "@/lib/listings/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID: GatewayName[] = ["jazzcash", "easypaisa"];

/**
 * Payment callback.
 *
 * This endpoint is the ONLY thing that may mark an order paid. It is public
 * and unauthenticated by necessity — the gateway calls it, not the user —
 * which is exactly why the signature check in the driver and the amount
 * check in applyPaidOrder are the entire security model.
 *
 * Anyone can POST here. Nothing is trusted until the hash verifies.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ gateway: string }> },
) {
  const { gateway } = await params;
  if (!VALID.includes(gateway as GatewayName)) {
    return NextResponse.json({ error: "Unknown gateway" }, { status: 404 });
  }

  const form = await request.formData();
  const payload: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") payload[k] = v;
  }

  const driver = getDriver(gateway as GatewayName);
  const verified = driver.verifyCallback(payload);
  const applied = await applyPaidOrder(gateway as GatewayName, verified);

  // The gateway redirects the customer's browser here too, so respond with a
  // redirect to somewhere human rather than JSON.
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (!applied.ok) {
    return NextResponse.redirect(
      `${base}/promote/failed?reason=${encodeURIComponent(applied.error)}`,
      { status: 303 },
    );
  }

  let target = `${base}/dashboard?promoted=1`;
  if (applied.listingId) {
    const [row] = await db
      .select({ slug: listings.slug, vertical: listings.vertical })
      .from(listings)
      .where(eq(listings.id, applied.listingId))
      .limit(1);
    if (row) {
      target = `${base}${buildListingPath(row.vertical, row.slug, applied.listingId)}?promoted=1`;
    }
  }

  return NextResponse.redirect(target, { status: 303 });
}

/** Some gateways send the customer back via GET with the same params. */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ gateway: string }> },
) {
  const url = new URL(request.url);
  const form = new FormData();
  url.searchParams.forEach((v, k) => form.append(k, v));

  return POST(
    new Request(request.url, { method: "POST", body: form }),
    ctx,
  );
}
