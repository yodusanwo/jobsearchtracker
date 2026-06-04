import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div
      className="jl"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--paper)",
      }}
    >
      <div
        style={{
          width: "min(420px, 100%)",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: "32px 28px",
        }}
      >
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <div
            className="jl-display"
            style={{ fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", marginBottom: 6 }}
          >
            Ledger
          </div>
          <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 14, fontStyle: "italic" }}>
            a quiet space for your search
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
