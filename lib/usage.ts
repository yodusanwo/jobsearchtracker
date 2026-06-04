/** USD per million tokens — update when Anthropic changes pricing. */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-opus-4-8": { input: 15, output: 75 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export function estimateUsageCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const rates = MODEL_PRICING[model] ?? MODEL_PRICING[DEFAULT_MODEL];
  const markup = Number(process.env.USAGE_MARKUP ?? "1.25");
  const inputCost = (inputTokens / 1_000_000) * rates.input;
  const outputCost = (outputTokens / 1_000_000) * rates.output;
  return Math.max(1, Math.ceil((inputCost + outputCost) * markup * 100));
}

export type UsageEventInput = {
  userId: string;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type UsageSummary = {
  periodStart: string;
  totalCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  callCount: number;
  byFeature: Record<string, { costCents: number; callCount: number }>;
  billingStatus: string;
  trialRemainingCents: number;
};

export function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Comma-separated in USAGE_UNLIMITED_EMAILS — bypass trial limits and Stripe metering. */
export function getUnlimitedEmails() {
  const raw = process.env.USAGE_UNLIMITED_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isUnlimitedEmail(email: string | null | undefined) {
  if (!email) return false;
  return getUnlimitedEmails().has(email.trim().toLowerCase());
}
