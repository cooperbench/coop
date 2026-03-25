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
 * Given a base scope and existing scopes from the DB, pick which scope to claim.
 * - If the base scope is dead or absent, take it.
 * - Otherwise find the lowest dead/absent numbered slot (#2, #3, ...).
 */
export function pickScope(base: string, existing: ExistingScope[]): string {
  // Only consider scopes that are exactly the base or base#N
  const relevant = existing.filter(
    (e) => e.scope === base || e.scope.startsWith(`${base}#`)
  );

  const baseEntry = relevant.find((e) => e.scope === base);
  if (!baseEntry || !isAlive(baseEntry)) return base;

  // Base is alive — find the lowest available numbered slot
  const numbered = new Map<number, ExistingScope>();
  for (const e of relevant) {
    const match = e.scope.match(/#(\d+)$/);
    if (match) numbered.set(parseInt(match[1]!), e);
  }

  for (let n = 2; ; n++) {
    const entry = numbered.get(n);
    if (!entry || !isAlive(entry)) return `${base}#${n}`;
  }
}
