import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureStripeCustomer, getStripe, isStripeConfigured } from "@/lib/billing";

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const priceId = process.env.STRIPE_USAGE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: "STRIPE_USAGE_PRICE_ID not set" }, { status: 503 });
  }

  const customerId = await ensureStripeCustomer(user.id, user.email);
  const stripe = getStripe();
  const origin = new URL(req.url).origin;

  const session = await stripe.checkout.sessions.create({
    customer: customerId!,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/?billing=success`,
    cancel_url: `${origin}/?billing=canceled`,
    metadata: { supabase_user_id: user.id },
  });

  return NextResponse.json({ url: session.url });
}
