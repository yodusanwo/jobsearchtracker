# Gmail setup (personal use — Testing mode, no audit)

Ledger connects to Gmail via [Google's Gmail MCP server](https://developers.google.com/workspace/gmail/api/guides/configure-mcp-server) and Anthropic's MCP connector. OAuth tokens are stored server-side in Supabase (`user_integrations`).

## 1. Run the schema migration

In Supabase → SQL Editor, run the `user_integrations` block from `supabase/schema.sql` (or re-run the full file).

## 2. Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable APIs:
   - **Gmail API** (`gmail.googleapis.com`)
   - **Gmail MCP API** (`gmailmcp.googleapis.com`) — under Workspace Developer Preview if prompted

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
3. **Authorized redirect URIs**:
   - `http://localhost:3000/api/google/callback`
   - `https://YOUR_PRODUCTION_DOMAIN/api/google/callback` (when deployed)
4. Copy **Client ID** and **Client secret**

## 5. Environment variables

Add to `.env.local`:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
```

Restart `npm run dev`.

## 6. Connect in Ledger

1. Sign in to Ledger
2. Open **Inbox**
3. Click **Connect Gmail**
4. Approve scopes (you may see “Google hasn’t verified this app” — expected in Testing mode)
5. Click **Scan Gmail**

## Troubleshooting

- **No refresh token** — revoke Ledger at [Google Account permissions](https://myaccount.google.com/permissions) and connect again (`prompt=consent` is already set).
- **403 / permission denied on search** — confirm Gmail MCP API is enabled and scopes include `gmail.readonly`.
- **Connect button missing** — `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` not set or dev server not restarted.
