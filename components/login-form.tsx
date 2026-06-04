"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });
      if (authError) throw authError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send link");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div style={{ textAlign: "center" }}>
        <h2 className="jl-display" style={{ fontSize: 24, fontWeight: 500, margin: "0 0 12px" }}>
          Check your email
        </h2>
        <p style={{ color: "var(--ink-3)", fontSize: 15, lineHeight: 1.6, margin: 0 }}>
          We sent a sign-in link to <strong style={{ color: "var(--ink-2)" }}>{email}</strong>.
          Click it to open your ledger — no password needed.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
      <div>
        <label htmlFor="email" style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--ink-2)" }}>
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{
            width: "100%", padding: "11px 14px", border: "1px solid var(--line)",
            borderRadius: 8, background: "var(--surface)", color: "var(--ink)",
            fontSize: 15, outline: "none",
          }}
        />
      </div>
      {error && (
        <p style={{ margin: 0, color: "var(--rose)", fontSize: 13 }}>{error}</p>
      )}
      <button
        type="submit"
        disabled={loading || !email.trim()}
        style={{
          padding: "11px 18px", borderRadius: 8, border: "none", cursor: "pointer",
          background: "var(--accent)", color: "white", fontSize: 15, fontWeight: 500,
          opacity: loading || !email.trim() ? 0.6 : 1,
        }}
      >
        {loading ? "Sending…" : "Send magic link"}
      </button>
      <p style={{ margin: 0, color: "var(--ink-4)", fontSize: 12, lineHeight: 1.5 }}>
        AI features are billed based on actual usage. New accounts include $5 in trial credit.
      </p>
    </form>
  );
}
