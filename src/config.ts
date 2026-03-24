import { resolve } from "path";
import { homedir, hostname } from "os";
import { readFileSync } from "fs";

export const CONFIG_DIR = resolve(homedir(), ".claude-coop");
export const AUTH_FILE = resolve(CONFIG_DIR, "auth.json");
export const CONFIG_FILE = resolve(CONFIG_DIR, "config.json");

// Bundled Supabase config — anon key is safe to ship publicly, RLS enforces access control
const BUNDLED_SUPABASE_URL = "https://jqmmsdeebveatufggbrx.supabase.co";
const BUNDLED_SUPABASE_ANON_KEY = "sb_publishable_jat4plFkv2LIfKT7wAS7Jw_41iT0ZLr";

// Allow env var override for development
export const SUPABASE_URL = process.env["COOP_SUPABASE_URL"] ?? BUNDLED_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env["COOP_SUPABASE_ANON_KEY"] ?? BUNDLED_SUPABASE_ANON_KEY;

type CoopConfig = {
  machineName?: string;
};

function loadConfig(): CoopConfig {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as CoopConfig;
  } catch {
    return {};
  }
}

export function getMachineName(): string {
  return loadConfig().machineName ?? hostname().replace(/\.local$/, "");
}

// How long before a peer is considered offline (ms)
export const PEER_TIMEOUT_MS = 2 * 60 * 1000;

// Heartbeat interval (ms)
export const HEARTBEAT_INTERVAL_MS = 60 * 1000;

// Hosted callback page for headless/remote login (GitHub Pages)
export const HOSTED_CALLBACK_URL = "https://cooperbench.github.io/claude-coop/callback";
