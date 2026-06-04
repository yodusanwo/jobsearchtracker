"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { formatCents } from "@/lib/usage";

type UsageSummary = {
  totalCostCents: number;
  callCount: number;
  billingStatus: string;
  trialRemainingCents: number;
  byFeature: Record<string, { costCents: number; callCount: number }>;
};

export function UsageBadge() {
  const { user, configured } = useAuth();
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    if (!user || !configured) return;
    fetch("/api/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then(setUsage)
      .catch(() => {});
  }, [user, configured]);

  if (!configured || !user) return null;

  const startCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setCheckoutLoading(false);
    }
  };

  const needsBilling =
    usage &&
    usage.billingStatus !== "unlimited" &&
    (usage.billingStatus === "trial_exhausted" ||
      usage.billingStatus === "past_due" ||
      (usage.billingStatus === "trial" && usage.trialRemainingCents <= 100));

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--ink-3)" }}>
      {usage && (
        <span title="AI usage this month">
          AI: {formatCents(usage.totalCostCents)}
          {usage.billingStatus === "unlimited" && <> · unlimited</>}
          {usage.billingStatus === "trial" && (
            <> · {formatCents(usage.trialRemainingCents)} trial left</>
          )}
        </span>
      )}
      {needsBilling && (
        <button
          onClick={startCheckout}
          disabled={checkoutLoading}
          style={{
            background: "var(--accent)", color: "white", border: "none",
            borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer",
          }}
        >
          {checkoutLoading ? "…" : "Add billing"}
        </button>
      )}
      <span style={{ color: "var(--ink-4)" }}>{user.email}</span>
    </div>
  );
}
