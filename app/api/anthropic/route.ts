import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { checkUsageAllowed, recordUsageEvent } from "@/lib/billing";
import { getGmailAccessToken } from "@/lib/google/tokens";

export const maxDuration = 60;

type McpServer = {
  type?: string;
  url?: string;
  name?: string;
  authorization_token?: string;
};

function isGmailMcpServer(server: McpServer) {
  return (
    server.name === "gmail" ||
    (typeof server.url === "string" && server.url.includes("gmailmcp.googleapis.com"))
  );
}

function ensureMcpToolsets(body: Record<string, unknown>) {
  const servers = body.mcp_servers as McpServer[] | undefined;
  if (!Array.isArray(servers) || servers.length === 0) return;

  const existingTools = Array.isArray(body.tools) ? [...body.tools] : [];
  const names = new Set(
    existingTools
      .filter((t) => t && typeof t === "object" && (t as { type?: string }).type === "mcp_toolset")
      .map((t) => (t as { mcp_server_name?: string }).mcp_server_name)
      .filter(Boolean)
  );

  for (const server of servers) {
    if (!server.name || names.has(server.name)) continue;
    existingTools.push({ type: "mcp_toolset", mcp_server_name: server.name });
    names.add(server.name);
  }

  body.tools = existingTools;
}

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
    ensureMcpToolsets(body);

    const needsGmail = (body.mcp_servers as McpServer[]).some(isGmailMcpServer);
    if (needsGmail) {
      if (!userId) {
        return NextResponse.json(
          { error: "Sign in required for Gmail", code: "gmail_not_connected" },
          { status: 401 }
        );
      }
      let gmailToken: string | null;
      try {
        gmailToken = await getGmailAccessToken(userId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "GMAIL_STORAGE_NOT_READY") {
          return NextResponse.json(
            {
              error: "Gmail storage is not set up. Run the user_integrations SQL in Supabase (see docs/gmail-setup.md), then connect Gmail again.",
              code: "gmail_storage_not_ready",
            },
            { status: 503 }
          );
        }
        console.error("Gmail token load failed:", e);
        return NextResponse.json(
          { error: "Could not load Gmail connection", code: "gmail_token_error" },
          { status: 500 }
        );
      }
      if (!gmailToken) {
        return NextResponse.json(
          { error: "Connect Gmail in the Inbox tab first", code: "gmail_not_connected" },
          { status: 403 }
        );
      }
      body.mcp_servers = (body.mcp_servers as McpServer[]).map((server) =>
        isGmailMcpServer(server) ? { ...server, authorization_token: gmailToken } : server
      );
    }
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error("anthropic upstream error", upstream.status, JSON.stringify(data).slice(0, 2000));
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
