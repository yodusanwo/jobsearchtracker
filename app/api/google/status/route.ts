import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isGoogleOAuthConfigured, loadGmailTokens } from "@/lib/google/tokens";

export async function GET() {
  const configured = isGoogleOAuthConfigured();

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured, connected: false, email: null });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ configured, connected: false, email: null }, { status: 401 });
  }

  const tokens = await loadGmailTokens(user.id);
  return NextResponse.json({
    configured,
    connected: !!tokens?.refresh_token,
    email: tokens?.email ?? null,
  });
}
