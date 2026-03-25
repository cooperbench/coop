import { PEER_TIMEOUT_MS } from "../config.ts";
import type { PeerStatus } from "../types.ts";

type ExistingScope = {
  scope: string;
  status: PeerStatus;
  last_seen: string;
};

/** Returns true if the scope is alive (online with a fresh heartbeat). */
function isAlive(entry: ExistingScope): boolean {
  if (entry.status === "offline") return false;
  return Date.now() - new Date(entry.last_seen).getTime() <= PEER_TIMEOUT_MS;
}

/**
 * Build a numbered scope: insert #N before the @machine part.
 * e.g. "user/repo@machine" + 2 → "user/repo#2@machine"
 */
function numberedScope(base: string, n: number): string {
  const atIdx = base.lastIndexOf("@");
  if (atIdx === -1) return `${base}#${n}`;
  return `${base.slice(0, atIdx)}#${n}${base.slice(atIdx)}`;
}

/**
 * Extract session number from a scope, or 1 for the base scope.
 * e.g. "user/repo#3@machine" → 3, "user/repo@machine" → null
 */
function sessionNumber(scope: string): number | null {
  const match = scope.match(/#(\d+)@/);
  return match ? parseInt(match[1]!) : null;
}

/**
 * Check if a scope is related to the base (is the base itself or a numbered variant).
 */
function isRelated(scope: string, base: string): boolean {
  if (scope === base) return true;
  const atIdx = base.lastIndexOf("@");
  if (atIdx === -1) return scope.startsWith(`${base}#`);
  const prefix = base.slice(0, atIdx);
  const suffix = base.slice(atIdx);
  return scope.startsWith(`${prefix}#`) && scope.endsWith(suffix);
}

/**
 * Given a base scope and existing scopes from the DB, pick which scope to claim.
 * - If the base scope is dead or absent, take it.
 * - Otherwise find the lowest dead/absent numbered slot (#2, #3, ...).
 * Format: "user/repo#N@machine" (session number goes with the repo).
 */
export function pickScope(base: string, existing: ExistingScope[]): string {
  const relevant = existing.filter((e) => isRelated(e.scope, base));

  const baseEntry = relevant.find((e) => e.scope === base);
  if (!baseEntry || !isAlive(baseEntry)) return base;

  // Base is alive — find the lowest available numbered slot
  const numbered = new Map<number, ExistingScope>();
  for (const e of relevant) {
    const n = sessionNumber(e.scope);
    if (n !== null) numbered.set(n, e);
  }

  for (let n = 2; ; n++) {
    const entry = numbered.get(n);
    if (!entry || !isAlive(entry)) return numberedScope(base, n);
  }
}
