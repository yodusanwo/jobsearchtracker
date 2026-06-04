/** Gmail scopes required by Google's Gmail MCP server. */
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

export function gmailScopeString() {
  return GMAIL_SCOPES.join(" ");
}
