import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForTokens, saveGmailTokens } from "@/lib/google/tokens";
import { resolveSiteUrl } from "@/lib/google/site-url";

export async function GET(req: NextRequest) {
  const base = resolveSiteUrl(req);
  const fail = (msg: string) =>
    NextResponse.redirect(new URL(`/?tab=inbox&gmail_error=${encodeURIComponent(msg)}`, base));

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");

  if (oauthError) {
    return fail(oauthError);
  }
  if (!code || !state) {
    return fail("Missing OAuth code");
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_oauth_state")?.value;
  const userId = cookieStore.get("google_oauth_uid")?.value;

  cookieStore.delete("google_oauth_state");
  cookieStore.delete("google_oauth_uid");

  if (!expectedState || state !== expectedState || !userId) {
    return fail("Invalid OAuth state — try connecting again");
  }

  try {
    const redirectUri = `${base}/api/google/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    await saveGmailTokens(userId, tokens);
    const email = tokens.email ? `&gmail_email=${encodeURIComponent(tokens.email)}` : "";
    return NextResponse.redirect(new URL(`/?tab=inbox&gmail=connected${email}`, base));
  } catch (e) {
    const message = e instanceof Error ? e.message : "OAuth failed";
    if (message === "GMAIL_STORAGE_NOT_READY") {
      return fail("Run user_integrations SQL in Supabase first (see docs/gmail-setup.md)");
    }
    return fail(message);
  }
}
