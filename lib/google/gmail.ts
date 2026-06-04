export type GmailApiErrorInfo = {
  code: string;
  message: string;
  enableUrl?: string;
};

export function parseGmailApiError(raw: string): GmailApiErrorInfo | null {
  if (
    !raw.includes("Gmail API has not been used") &&
    !raw.includes("gmail.googleapis.com") &&
    !raw.includes("accessNotConfigured")
  ) {
    return null;
  }
  const projectMatch = raw.match(/project[= ](\d+)/i);
  const project = projectMatch?.[1];
  const enableUrl = project
    ? `https://console.developers.google.com/apis/api/gmail.googleapis.com/overview?project=${project}`
    : "https://console.cloud.google.com/apis/library/gmail.googleapis.com";
  return {
    code: "gmail_api_disabled",
    message:
      "The Gmail API is not enabled for your Google Cloud project. Enable it, wait ~1 minute, then click Refresh summary.",
    enableUrl,
  };
}

export type RecentEmail = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  fromName: string;
  fromEmail: string;
  date: string;
  snippet: string;
};

function getHeader(headers: { name: string; value: string }[], name: string) {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function parseFromHeader(from: string): { name: string; email: string } {
  const angle = from.match(/^(.+?)\s*<([^>]+)>$/);
  if (angle) {
    return {
      name: angle[1].replace(/^"|"$/g, "").trim(),
      email: angle[2].trim(),
    };
  }
  if (from.includes("@")) return { name: "", email: from.trim() };
  return { name: from.trim(), email: "" };
}

async function listMessageIds(accessToken: string, limit: number, labelIds?: string) {
  const params = new URLSearchParams({ maxResults: String(limit) });
  if (labelIds) params.set("labelIds", labelIds);
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ||
        `Gmail list failed (${res.status})`
    );
  }
  const data = (await res.json()) as { messages?: { id: string; threadId: string }[] };
  return data.messages ?? [];
}

async function fetchMessage(accessToken: string, id: string, threadId: string): Promise<RecentEmail | null> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  const msg = (await res.json()) as {
    internalDate?: string;
    snippet?: string;
    payload?: { headers?: { name: string; value: string }[] };
  };
  const headers = msg.payload?.headers ?? [];
  const from = getHeader(headers, "From");
  const { name, email } = parseFromHeader(from);
  const dateMs = Number(msg.internalDate);
  return {
    id,
    threadId,
    subject: getHeader(headers, "Subject") || "(no subject)",
    from,
    fromName: name,
    fromEmail: email,
    date: Number.isFinite(dateMs)
      ? new Date(dateMs).toISOString()
      : getHeader(headers, "Date") || new Date().toISOString(),
    snippet: msg.snippet || "",
  };
}

/** Fetch the user's most recent Gmail messages (Inbox first, then all mail). */
export async function fetchRecentEmails(accessToken: string, limit = 10): Promise<RecentEmail[]> {
  let messages = await listMessageIds(accessToken, limit, "INBOX");
  if (!messages.length) {
    messages = await listMessageIds(accessToken, limit);
  }
  if (!messages.length) return [];

  const emails = await Promise.all(
    messages.slice(0, limit).map((m) => fetchMessage(accessToken, m.id, m.threadId))
  );
  return emails.filter((e): e is RecentEmail => e !== null);
}
