import { NextRequest, NextResponse } from "next/server";
import { isGoogleOAuthConfigured } from "@/lib/google/tokens";
import { gmailRedirectUri, resolveSiteUrl } from "@/lib/google/site-url";

/** Returns the OAuth redirect URI Ledger will use — copy this into Google Cloud. */
export async function GET(req: NextRequest) {
  const base = resolveSiteUrl(req);
  return NextResponse.json({
    configured: isGoogleOAuthConfigured(),
    siteUrl: base,
    redirectUri: gmailRedirectUri(req),
    hint: "Add redirectUri exactly to Google Auth Platform → Clients → Web application → Authorized redirect URIs",
  });
}
