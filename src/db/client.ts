import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { SUPABASE_URL, SUPABASE_ANON_KEY, AUTH_FILE, CONFIG_DIR } from "../config.ts";

// Custom storage adapter so Supabase persists and auto-refreshes the session
const fileStorage = {
  getItem(key: string): string | null {
    try {
      const store = JSON.parse(readFileSync(AUTH_FILE, "utf8")) as Record<string, string>;
      return store[key] ?? null;
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    let store: Record<string, string> = {};
    try { store = JSON.parse(readFileSync(AUTH_FILE, "utf8")); } catch { /* first write */ }
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(AUTH_FILE, JSON.stringify({ ...store, [key]: value }, null, 2), { mode: 0o600 });
  },
  removeItem(key: string): void {
    try {
      const store = JSON.parse(readFileSync(AUTH_FILE, "utf8")) as Record<string, string>;
      delete store[key];
      writeFileSync(AUTH_FILE, JSON.stringify(store, null, 2));
    } catch { /* nothing to remove */ }
  },
};

let _client: SupabaseClient | null = null;

export function getClient(): SupabaseClient {
  if (_client) return _client;

  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      storage: fileStorage,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return _client;
}
