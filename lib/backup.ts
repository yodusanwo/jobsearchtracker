import { storage } from "./storage";

export const BACKUP_VERSION = 1;

export const BACKUP_KEYS = [
  "applications",
  "outreach",
  "meetings",
  "inboxState",
  "contacts",
  "campaignSettings",
  "companies",
  "briefing",
] as const;

export type BackupKey = (typeof BACKUP_KEYS)[number];

export type LedgerBackup = {
  version: number;
  app: "ledger";
  exportedAt: string;
  data: Partial<Record<BackupKey, unknown>>;
};

export async function collectBackupData(): Promise<LedgerBackup> {
  const data: Partial<Record<BackupKey, unknown>> = {};

  for (const key of BACKUP_KEYS) {
    try {
      const r = await storage.get(key);
      if (r?.value) data[key] = JSON.parse(r.value);
    } catch {
      // key not stored yet — skip
    }
  }

  return {
    version: BACKUP_VERSION,
    app: "ledger",
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function downloadBackup(backup: LedgerBackup) {
  const date = backup.exportedAt.slice(0, 10);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ledger-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseBackupText(text: string): LedgerBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("File is not valid JSON");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as LedgerBackup).app !== "ledger" ||
    !(parsed as LedgerBackup).data ||
    typeof (parsed as LedgerBackup).data !== "object"
  ) {
    throw new Error("Not a valid Ledger backup file");
  }

  return parsed as LedgerBackup;
}

export async function applyBackup(backup: LedgerBackup) {
  for (const key of BACKUP_KEYS) {
    if (key in backup.data) {
      await storage.set(key, JSON.stringify(backup.data[key]));
    }
  }
}

export function summarizeBackup(backup: LedgerBackup) {
  const d = backup.data;
  const count = (key: BackupKey) => (Array.isArray(d[key]) ? d[key].length : d[key] ? 1 : 0);

  return {
    exportedAt: backup.exportedAt,
    version: backup.version,
    applications: count("applications"),
    outreach: count("outreach"),
    meetings: count("meetings"),
    contacts: count("contacts"),
    companies: count("companies"),
    hasProfile: !!d.campaignSettings,
    hasInbox: !!d.inboxState,
    hasBriefing: !!d.briefing,
  };
}
