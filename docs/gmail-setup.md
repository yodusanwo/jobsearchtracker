# Gmail setup (personal use — Testing mode, no audit)

Ledger connects to Gmail via [Google's Gmail MCP server](https://developers.google.com/workspace/gmail/api/guides/configure-mcp-server) and Anthropic's MCP connector. OAuth tokens are stored server-side in Supabase (`user_integrations`).

## 1. Run the schema migration (required)

In Supabase → **SQL Editor**, run this (or re-run the full `supabase/schema.sql`):

```sql
create table if not exists public.user_integrations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  gmail_tokens jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_integrations enable row level security;
```

Without this table, Gmail connect and scan will fail.

## 2. Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable APIs (**both required**):
   - **[Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com)** (`gmail.googleapis.com`) — **required** for Inbox summary (reads your last 10 emails)
   - **Gmail MCP API** (`gmailmcp.googleapis.com`) — optional; only needed for MCP-based features

   After enabling Gmail API, wait ~1 minute before retrying in Ledger.

## 3. OAuth consent screen (Testing mode)

1. **Google Auth Platform → Branding** — app name e.g. `Ledger`
2. **Audience → External** (or Internal if Workspace)
3. **Audience → Test users** — add `yodusanwo@gmail.com` (and any other users)
4. **Data Access → Add scopes** (paste manually):
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.compose`
   - `https://www.googleapis.com/auth/userinfo.email`
5. Leave app in **Testing** — no $500 security audit required for test users

## 4. OAuth client (Web application)

1. **Google Auth Platform → Clients → Create client**
2. Type: **Web application**
3. **Authorized redirect URIs** (add both if you use local + production):
   - `http://localhost:3000/api/google/callback`
   - `https://jobsearchtracker.vercel.app/api/google/callback`
4. **Authorized JavaScript origins** (optional):
   - `http://localhost:3000`
   - `https://jobsearchtracker.vercel.app`
5. Copy **Client ID** and **Client secret**

### OAuth consent screen — authorized domain (production)

Under **Google Auth Platform → Branding → Authorized domains**, add:

- `jobsearchtracker.vercel.app`

(This is for app branding/links on the consent screen. The redirect URI above is what actually makes OAuth work.)

## 5. Environment variables

**Local** (`.env.local`):

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
```

**Vercel** (Project → Settings → Environment Variables) — same keys, production values:

```env
NEXT_PUBLIC_SITE_URL=https://jobsearchtracker.vercel.app
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

No trailing slash on `NEXT_PUBLIC_SITE_URL`. Redeploy after changing Vercel env vars.

**Supabase** (Authentication → URL Configuration) — add redirect URLs:

- `https://jobsearchtracker.vercel.app/auth/callback`
- `http://localhost:3000/auth/callback` (for local dev)

## 6. Connect in Ledger

1. Sign in to Ledger
2. Open **Inbox**
3. Click **Connect Gmail**
4. Approve scopes (you may see “Google hasn’t verified this app” — expected in Testing mode)
5. Click **Summarize inbox**

## Troubleshooting

- **"Gmail API has not been used in project … or it is disabled"** — open [Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com) for your project, click **Enable**, wait a minute, then **Refresh summary** in Inbox. OAuth alone is not enough; the REST API must be enabled separately.
- **No refresh token** — revoke Ledger at [Google Account permissions](https://myaccount.google.com/permissions) and connect again (`prompt=consent` is already set).
- **403 / permission denied** — confirm scopes include `gmail.readonly` on the OAuth consent screen.
- **Connect button missing** — `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` not set or dev server not restarted.
