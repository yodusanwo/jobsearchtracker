import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { gmailScopeString } from "./scopes";

export type GmailTokenRecord = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  email?: string;
  scope?: string;
};

const TABLE = "user_integrations";

function getGoogleClientConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  }
  return { clientId, clientSecret };
}

export function isGoogleOAuthConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export async function loadGmailTokens(userId: string): Promise<GmailTokenRecord | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("gmail_tokens")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const tokens = data?.gmail_tokens as GmailTokenRecord | null | undefined;
  if (!tokens?.access_token) return null;
  return tokens;
}

export async function saveGmailTokens(userId: string, tokens: GmailTokenRecord) {
  if (!isSupabaseAdminConfigured()) {
    throw new Error("Supabase service role required to store Gmail tokens");
  }
  const supabase = createServiceClient();
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      gmail_tokens: tokens,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

export async function deleteGmailTokens(userId: string) {
  if (!isSupabaseAdminConfigured()) return;
  const supabase = createServiceClient();
  await supabase.from(TABLE).delete().eq("user_id", userId);
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  scope?: string;
}> {
  const { clientId, clientSecret } = getGoogleClientConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || "Token refresh failed");
  }
  return data;
}

/** Returns a valid Gmail access token for MCP / API calls. Refreshes when expired. */
export async function getGmailAccessToken(userId: string): Promise<string | null> {
  const record = await loadGmailTokens(userId);
  if (!record?.access_token) return null;

  const stillValid = record.expires_at > Date.now() + 60_000;
  if (stillValid) return record.access_token;

  if (!record.refresh_token) return null;

  try {
    const refreshed = await refreshAccessToken(record.refresh_token);
    const next: GmailTokenRecord = {
      ...record,
      access_token: refreshed.access_token,
      expires_at: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
      scope: refreshed.scope ?? record.scope,
    };
    await saveGmailTokens(userId, next);
    return next.access_token;
  } catch (e) {
    console.error("Gmail token refresh failed:", e);
    return null;
  }
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<GmailTokenRecord> {
  const { clientId, clientSecret } = getGoogleClientConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || "OAuth exchange failed");
  }
  if (!data.refresh_token) {
    throw new Error(
      "No refresh token received. Revoke Ledger access at myaccount.google.com/permissions and connect again."
    );
  }

  let email: string | undefined;
  try {
    const profile = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (profile.ok) {
      const p = await profile.json();
      email = p.email;
    }
  } catch {
    // optional
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
    email,
    scope: data.scope ?? gmailScopeString(),
  };
}

export function buildGoogleAuthUrl(redirectUri: string, state: string) {
  const { clientId } = getGoogleClientConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: gmailScopeString(),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
