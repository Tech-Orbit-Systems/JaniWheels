import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { listings } from "@/db/schema/listings";
import { getCurrentUser } from "@/lib/auth/session";
import { getDriver, type GatewayName } from "@/lib/payments";
import { createOrder } from "@/lib/payments/orders";
import { renderGatewayForm } from "@/lib/payments/render-form";

export const runtime = "nodejs";

const VALID: GatewayName[] = ["jazzcash", "easypaisa"];

/** Creates the order, then hands back a signed self-submitting gateway form. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/login?next=/dashboard", request.url),
      { status: 303 },
    );
  }

  const form = await request.formData();
  const listingId = Number(form.get("listingId"));
  const adPackageId = Number(form.get("adPackageId"));
  const gateway = String(form.get("gateway") ?? "") as GatewayName;

  if (!VALID.includes(gateway)) {
    return NextResponse.json({ error: "Choose a payment method" }, { status: 400 });
  }

  const driver = getDriver(gateway);
  if (!driver.isConfigured()) {
    return NextResponse.json(
      { error: `${gateway} is not configured on this environment` },
      { status: 503 },
    );
  }

  // Ownership check — otherwise anyone could promote anyone's listing, or
  // more usefully for an attacker, enumerate listing ids via error responses.
  const [listing] = await db
    .select({ id: listings.id, title: listings.title })
    .from(listings)
    .where(and(eq(listings.id, listingId), eq(listings.sellerId, user.id)))
    .limit(1);

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const { order } = await createOrder({
    userId: user.id,
    listingId: listing.id,
    adPackageId,
  });

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  const checkout = driver.buildCheckout({
    orderReference: order.reference,
    amountPkr: order.amountPkr,
    description: `Promotion for ${listing.title}`,
    customerPhone: user.phone.replace("+92", "0"),
    returnUrl: `${base}/api/payments/callback/${gateway}`,
  });

  return renderGatewayForm(checkout, gateway, order.reference);
}
