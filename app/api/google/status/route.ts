import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { loadGmailTokens, isGoogleOAuthConfigured } from "@/lib/google/tokens";

export async function GET() {
  const configured = isGoogleOAuthConfigured();

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured, connected: false, email: null, storageReady: false });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ configured, connected: false, email: null, storageReady: false }, { status: 401 });
  }

  try {
    const tokens = await loadGmailTokens(user.id);
    return NextResponse.json({
      configured,
      connected: !!tokens?.refresh_token,
      email: tokens?.email ?? null,
      storageReady: true,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "GMAIL_STORAGE_NOT_READY") {
      return NextResponse.json({
        configured,
        connected: false,
        email: null,
        storageReady: false,
        setupRequired: true,
      });
    }
    throw e;
  }
}
