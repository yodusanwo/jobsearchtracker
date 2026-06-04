import type { NextRequest } from "next/server";

function originFromRequest(req: NextRequest): string | null {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return null;
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`.replace(/\/$/, "");
}

/** Origin for OAuth redirects — use the incoming request host when available. */
export function resolveSiteUrl(req?: NextRequest): string {
  const fromRequest = req ? originFromRequest(req) : null;
  if (fromRequest) return fromRequest;

  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

export function gmailRedirectUri(req?: NextRequest) {
  return `${resolveSiteUrl(req)}/api/google/callback`;
}
