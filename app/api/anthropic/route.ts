import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { checkUsageAllowed, recordUsageEvent } from "@/lib/billing";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not set on server" },
      { status: 500 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const feature = typeof body.feature === "string" ? body.feature : "general";
  delete body.feature;

  let userId: string | null = null;
  let userEmail: string | null = null;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    userId = user.id;
    userEmail = user.email ?? null;
    const gate = await checkUsageAllowed(userId, userEmail);
    if (!gate.allowed) {
      return NextResponse.json(
        { error: gate.reason, billingStatus: gate.billingStatus },
        { status: 402 }
      );
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };

  if (Array.isArray(body.mcp_servers) && body.mcp_servers.length > 0) {
    headers["anthropic-beta"] = "mcp-client-2025-11-20";
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(data, { status: upstream.status });
    }

    if (userId && data.usage) {
      const model = typeof body.model === "string" ? body.model : "claude-sonnet-4-20250514";
      try {
        const { costCents } = await recordUsageEvent(
          {
            userId,
            feature,
            model,
            inputTokens: data.usage.input_tokens ?? 0,
            outputTokens: data.usage.output_tokens ?? 0,
          },
          userEmail
        );
        data._ledger = { costCents, feature };
      } catch (e) {
        console.error("usage record failed:", e);
      }
    }

    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
