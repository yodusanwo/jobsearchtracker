import type { NextRequest } from "next/server";

function originFromRequest(req: NextRequest): string | null {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return null;
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`.replace(/\/$/, "");
}

/** Origin for OAuth redirects — prefers env, then request host (Vercel), then localhost. */
export function resolveSiteUrl(req?: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const fromRequest = req ? originFromRequest(req) : null;

  // Deployed site must not redirect to localhost because env was copied from .env.local
  if (
    fromRequest &&
    !fromRequest.includes("localhost") &&
    fromEnv &&
    fromEnv.includes("localhost")
  ) {
    return fromRequest;
  }

  if (fromEnv) return fromEnv;
  if (fromRequest) return fromRequest;

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}
