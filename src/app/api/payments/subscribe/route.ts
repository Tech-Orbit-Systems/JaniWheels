import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getDealerForUser } from "@/lib/dealers/queries";
import { getDriver, availableGateways, type GatewayName } from "@/lib/payments";
import { createSubscriptionOrder } from "@/lib/payments/orders";
import { renderGatewayForm } from "@/lib/payments/render-form";

export const runtime = "nodejs";

/**
 * Dealer subscription checkout.
 *
 * Same shape as the promotion checkout — order first, then a signed
 * self-submitting form — but keyed on a plan rather than a listing.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/login?next=/dashboard/dealer", request.url),
      { status: 303 },
    );
  }

  const dealer = await getDealerForUser(user.id);
  if (!dealer) {
    return NextResponse.redirect(
      new URL("/dealers/register", request.url),
      { status: 303 },
    );
  }

  const form = await request.formData();
  const dealerPlanId = Number(form.get("dealerPlanId"));
  let gateway = String(form.get("gateway") ?? "") as GatewayName;

  const available = availableGateways();
  if (!available.includes(gateway)) {
    // Fall back to whatever is configured rather than dead-ending the dealer
    // on a form that named a gateway this environment can't use.
    if (available.length === 0) {
      return NextResponse.json(
        { error: "No payment gateway is configured." },
        { status: 503 },
      );
    }
    gateway = available[0];
  }

  const { order, plan } = await createSubscriptionOrder({
    userId: user.id,
    dealerPlanId,
  });

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const checkout = getDriver(gateway).buildCheckout({
    orderReference: order.reference,
    amountPkr: order.amountPkr,
    description: `${plan.name} plan — ${dealer.businessName}`,
    customerPhone: user.phone.replace("+92", "0"),
    returnUrl: `${base}/api/payments/callback/${gateway}`,
  });

  return renderGatewayForm(checkout, gateway, order.reference);
}
