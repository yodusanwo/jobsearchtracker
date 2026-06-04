// lib/storage.ts
//
// Per-user storage: Supabase when authenticated, localStorage as offline fallback.
// The async API matches the original Claude-artifact interface.

import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { BACKUP_KEYS } from "@/lib/backup";

type StorageResult = {
  key: string;
  value: string;
  shared?: boolean;
} | null;

type DeleteResult = {
  key: string;
  deleted: boolean;
  shared?: boolean;
};

type ListResult = {
  keys: string[];
  prefix?: string;
  shared?: boolean;
};

const isClient = typeof window !== "undefined";
let currentUserId: string | null = null;
const MIGRATION_FLAG = "ledger:cloud-migrated";

export function setStorageUserId(userId: string | null) {
  currentUserId = userId;
}

export function getStorageUserId() {
  return currentUserId;
}

export function isCloudStorageActive() {
  return isClient && isSupabaseConfigured() && !!currentUserId;
}

function localNs(shared: boolean) {
  return shared ? "ledger:shared:" : "ledger:user:";
}

async function cloudGet(key: string): Promise<StorageResult> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ledger_kv")
    .select("value")
    .eq("user_id", currentUserId!)
    .eq("key", key)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Key not found: ${key}`);
  return { key, value: JSON.stringify(data.value) };
}

async function cloudSet(key: string, value: string): Promise<StorageResult> {
  const supabase = createClient();
  const parsed = JSON.parse(value);
  const { error } = await supabase.from("ledger_kv").upsert(
    {
      user_id: currentUserId!,
      key,
      value: parsed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,key" }
  );
  if (error) throw error;
  return { key, value };
}

async function cloudDelete(key: string): Promise<DeleteResult> {
  const supabase = createClient();
  const { error, count } = await supabase
    .from("ledger_kv")
    .delete({ count: "exact" })
    .eq("user_id", currentUserId!)
    .eq("key", key);
  if (error) throw error;
  return { key, deleted: (count ?? 0) > 0 };
}

async function cloudList(prefix?: string): Promise<ListResult> {
  const supabase = createClient();
  let query = supabase
    .from("ledger_kv")
    .select("key")
    .eq("user_id", currentUserId!);

  if (prefix) query = query.like("key", `${prefix}%`);

  const { data, error } = await query;
  if (error) throw error;
  return { keys: (data ?? []).map((r) => r.key), prefix };
}

/** One-time migration of localStorage data to Supabase after first login. */
export async function migrateLocalStorageToCloud(userId: string) {
  if (!isClient || !isSupabaseConfigured()) return;
  const flag = `${MIGRATION_FLAG}:${userId}`;
  if (localStorage.getItem(flag)) return;

  setStorageUserId(userId);
  for (const key of BACKUP_KEYS) {
    try {
      const raw = window.localStorage.getItem(localNs(false) + key);
      if (!raw) continue;
      await cloudSet(key, raw);
    } catch {
      // skip keys that fail
    }
  }
  localStorage.setItem(flag, new Date().toISOString());
}

export const storage = {
  async get(key: string, shared = false): Promise<StorageResult> {
    if (!isClient) return null;
    if (isCloudStorageActive() && !shared) return cloudGet(key);
    const value = window.localStorage.getItem(localNs(shared) + key);
    if (value === null) throw new Error(`Key not found: ${key}`);
    return { key, value, shared };
  },

  async set(key: string, value: string, shared = false): Promise<StorageResult> {
    if (!isClient) return null;
    if (isCloudStorageActive() && !shared) return cloudSet(key, value);
    window.localStorage.setItem(localNs(shared) + key, value);
    return { key, value, shared };
  },

  async delete(key: string, shared = false): Promise<DeleteResult> {
    if (!isClient) return { key, deleted: false, shared };
    if (isCloudStorageActive() && !shared) return cloudDelete(key);
    const fullKey = localNs(shared) + key;
    const existed = window.localStorage.getItem(fullKey) !== null;
    window.localStorage.removeItem(fullKey);
    return { key, deleted: existed, shared };
  },

  async list(prefix?: string, shared = false): Promise<ListResult> {
    if (!isClient) return { keys: [], prefix, shared };
    if (isCloudStorageActive() && !shared) return cloudList(prefix);
    const ns = localNs(shared);
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const fullKey = window.localStorage.key(i);
      if (!fullKey || !fullKey.startsWith(ns)) continue;
      const unprefixed = fullKey.slice(ns.length);
      if (!prefix || unprefixed.startsWith(prefix)) keys.push(unprefixed);
    }
    return { keys, prefix, shared };
  },
};

export function installStorageGlobal() {
  if (isClient) {
    (window as unknown as { storage: typeof storage }).storage = storage;
  }
}
