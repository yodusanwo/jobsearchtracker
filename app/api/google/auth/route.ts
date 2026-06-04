import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { buildGoogleAuthUrl, isGoogleOAuthConfigured } from "@/lib/google/tokens";
import { resolveSiteUrl } from "@/lib/google/site-url";

export async function GET(req: NextRequest) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      { error: "Google OAuth is not configured on the server" },
      { status: 503 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const base = resolveSiteUrl(req);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/api/google/auth", base));
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  cookieStore.set("google_oauth_uid", user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const redirectUri = `${base}/api/google/callback`;
  const url = buildGoogleAuthUrl(redirectUri, state);
  return NextResponse.redirect(url);
}
