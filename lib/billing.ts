import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { estimateUsageCostCents, isUnlimitedEmail, type UsageEventInput } from "@/lib/usage";

export function isStripeConfigured() {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_METER_EVENT_NAME
  );
}

export function isBillingEnabled() {
  return isSupabaseAdminConfigured();
}

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

type BillingProfile = {
  user_id: string;
  email: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  billing_status: string;
  trial_remaining_cents: number;
};

async function getOrCreateBillingProfile(userId: string, email?: string | null) {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("billing_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing as BillingProfile;

  const { data: created, error } = await supabase
    .from("billing_profiles")
    .insert({ user_id: userId, email: email ?? null })
    .select("*")
    .single();

  if (error) throw error;
  return created as BillingProfile;
}

export async function ensureStripeCustomer(userId: string, email: string) {
  if (!isStripeConfigured()) return null;

  const profile = await getOrCreateBillingProfile(userId, email);
  if (profile.stripe_customer_id) return profile.stripe_customer_id;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    metadata: { supabase_user_id: userId },
  });

  const supabase = createServiceClient();
  await supabase
    .from("billing_profiles")
    .update({
      stripe_customer_id: customer.id,
      email,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return customer.id;
}

export async function reportUsageToStripe(userId: string, costCents: number) {
  if (!isStripeConfigured() || costCents <= 0) return;

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("billing_profiles")
    .select("stripe_customer_id, billing_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile?.stripe_customer_id || profile.billing_status !== "active") return;

  const stripe = getStripe();
  await stripe.billing.meterEvents.create({
    event_name: process.env.STRIPE_METER_EVENT_NAME!,
    payload: {
      stripe_customer_id: profile.stripe_customer_id,
      value: String(costCents),
    },
  });
}

export type UsageGateResult =
  | { allowed: true; billingStatus: string; trialRemainingCents: number }
  | { allowed: false; reason: string; billingStatus: string };

export async function checkUsageAllowed(
  userId: string,
  email?: string | null
): Promise<UsageGateResult> {
  if (!isBillingEnabled()) {
    return { allowed: true, billingStatus: "dev", trialRemainingCents: 0 };
  }

  if (isUnlimitedEmail(email)) {
    return { allowed: true, billingStatus: "unlimited", trialRemainingCents: 0 };
  }

  const profile = await getOrCreateBillingProfile(userId, email);

  if (isUnlimitedEmail(profile.email)) {
    return { allowed: true, billingStatus: "unlimited", trialRemainingCents: 0 };
  }

  if (profile.billing_status === "unlimited") {
    return { allowed: true, billingStatus: "unlimited", trialRemainingCents: 0 };
  }

  if (profile.billing_status === "active") {
    return { allowed: true, billingStatus: "active", trialRemainingCents: 0 };
  }

  if (profile.billing_status === "trial" && profile.trial_remaining_cents > 0) {
    return {
      allowed: true,
      billingStatus: "trial",
      trialRemainingCents: profile.trial_remaining_cents,
    };
  }

  return {
    allowed: false,
    reason: "Trial credit used up. Add a payment method to continue using AI features.",
    billingStatus: profile.billing_status,
  };
}

export async function recordUsageEvent(input: UsageEventInput, email?: string | null) {
  const costCents = estimateUsageCostCents(
    input.model,
    input.inputTokens,
    input.outputTokens
  );

  if (!isBillingEnabled()) {
    return { costCents };
  }

  const supabase = createServiceClient();

  const { error: insertError } = await supabase.from("api_usage_events").insert({
    user_id: input.userId,
    feature: input.feature,
    model: input.model,
    input_tokens: input.inputTokens,
    output_tokens: input.outputTokens,
    cost_cents: costCents,
  });

  if (insertError) throw insertError;

  const profile = await getOrCreateBillingProfile(input.userId, email);
  const unlimited = isUnlimitedEmail(email) || isUnlimitedEmail(profile.email);

  if (unlimited) {
    if (profile.billing_status !== "unlimited") {
      await supabase
        .from("billing_profiles")
        .update({
          billing_status: "unlimited",
          email: email ?? profile.email,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", input.userId);
    }
    return { costCents };
  }

  if (profile.billing_status === "trial") {
    const remaining = Math.max(0, profile.trial_remaining_cents - costCents);
    const nextStatus = remaining === 0 ? "trial_exhausted" : "trial";
    await supabase
      .from("billing_profiles")
      .update({
        trial_remaining_cents: remaining,
        billing_status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", input.userId);
  } else if (profile.billing_status === "active") {
    await reportUsageToStripe(input.userId, costCents);
  }

  return { costCents };
}

export async function getUsageSummary(userId: string, days = 30, email?: string | null) {
  const supabase = createServiceClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [{ data: events }, { data: profile }] = await Promise.all([
    supabase
      .from("api_usage_events")
      .select("feature, input_tokens, output_tokens, cost_cents, created_at")
      .eq("user_id", userId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false }),
    supabase
      .from("billing_profiles")
      .select("billing_status, trial_remaining_cents, email")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const byFeature: Record<string, { costCents: number; callCount: number }> = {};
  let totalCostCents = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const e of events ?? []) {
    totalCostCents += e.cost_cents;
    totalInputTokens += e.input_tokens;
    totalOutputTokens += e.output_tokens;
    if (!byFeature[e.feature]) {
      byFeature[e.feature] = { costCents: 0, callCount: 0 };
    }
    byFeature[e.feature].costCents += e.cost_cents;
    byFeature[e.feature].callCount += 1;
  }

  const unlimited =
    isUnlimitedEmail(email) ||
    isUnlimitedEmail(profile?.email) ||
    profile?.billing_status === "unlimited";

  return {
    periodStart: since.toISOString(),
    totalCostCents,
    totalInputTokens,
    totalOutputTokens,
    callCount: events?.length ?? 0,
    byFeature,
    billingStatus: unlimited ? "unlimited" : (profile?.billing_status ?? "trial"),
    trialRemainingCents: unlimited ? 0 : (profile?.trial_remaining_cents ?? 0),
  };
}
