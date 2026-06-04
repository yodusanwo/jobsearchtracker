"use client";

import dynamic from "next/dynamic";
import { useAuth } from "@/components/auth-provider";

const Ledger = dynamic(() => import("@/components/ledger"), { ssr: false });

export default function Home() {
  const { loading, configured } = useAuth();

  if (configured && loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          color: "var(--ink-3)",
          background: "var(--paper)",
        }}
      >
        Loading your ledger…
      </div>
    );
  }

  return <Ledger />;
}
