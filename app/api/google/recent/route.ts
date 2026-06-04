import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getGmailAccessToken } from "@/lib/google/tokens";
import { fetchRecentEmails } from "@/lib/google/gmail";

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? 10);
  const limit = Math.min(20, Math.max(1, Number.isFinite(limitParam) ? limitParam : 10));

  let token: string | null;
  try {
    token = await getGmailAccessToken(user.id);
  } catch (e) {
    if (e instanceof Error && e.message === "GMAIL_STORAGE_NOT_READY") {
      return NextResponse.json(
        {
          error: "Gmail storage is not set up. Run user_integrations SQL in Supabase.",
          code: "gmail_storage_not_ready",
        },
        { status: 503 }
      );
    }
    throw e;
  }

  if (!token) {
    return NextResponse.json(
      { error: "Connect Gmail in the Inbox tab first", code: "gmail_not_connected" },
      { status: 403 }
    );
  }

  try {
    const emails = await fetchRecentEmails(token, limit);
    return NextResponse.json({ emails, count: emails.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gmail fetch failed";
    console.error("Gmail recent fetch failed:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
