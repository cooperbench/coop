import { describe, it, expect } from "bun:test";
import { pickScope } from "../../src/session/claim-scope.ts";
import { PEER_TIMEOUT_MS } from "../../src/config.ts";
import type { PeerStatus } from "../../src/types.ts";

type ExistingScope = {
  scope: string;
  status: PeerStatus;
  last_seen: string;
};

const now = Date.now();
const fresh = () => new Date(now - 30_000).toISOString(); // 30s ago
const stale = () => new Date(now - PEER_TIMEOUT_MS - 5_000).toISOString();

describe("pickScope", () => {
  const base = "arpan/coop@macbook";

  it("returns the base scope when no existing scopes", () => {
    const result = pickScope(base, []);
    expect(result).toBe(base);
  });

  it("returns the base scope when it exists but is offline", () => {
    const existing: ExistingScope[] = [
      { scope: base, status: "offline", last_seen: stale() },
    ];
    const result = pickScope(base, existing);
    expect(result).toBe(base);
  });

  it("returns the base scope when it exists but heartbeat is stale", () => {
    const existing: ExistingScope[] = [
      { scope: base, status: "online", last_seen: stale() },
    ];
    const result = pickScope(base, existing);
    expect(result).toBe(base);
  });

  it("returns #2 (before @machine) when the base scope is alive", () => {
    const existing: ExistingScope[] = [
      { scope: base, status: "online", last_seen: fresh() },
    ];
    const result = pickScope(base, existing);
    expect(result).toBe("arpan/coop#2@macbook");
  });

  it("returns #3 when base and #2 are both alive", () => {
    const existing: ExistingScope[] = [
      { scope: base, status: "online", last_seen: fresh() },
      { scope: "arpan/coop#2@macbook", status: "online", last_seen: fresh() },
    ];
    const result = pickScope(base, existing);
    expect(result).toBe("arpan/coop#3@macbook");
  });

  it("reuses #2 when #2 is offline and base is alive", () => {
    const existing: ExistingScope[] = [
      { scope: base, status: "online", last_seen: fresh() },
      { scope: "arpan/coop#2@macbook", status: "offline", last_seen: stale() },
    ];
    const result = pickScope(base, existing);
    expect(result).toBe("arpan/coop#2@macbook");
  });

  it("reuses #2 when #2 has stale heartbeat and base is alive", () => {
    const existing: ExistingScope[] = [
      { scope: base, status: "online", last_seen: fresh() },
      { scope: "arpan/coop#2@macbook", status: "online", last_seen: stale() },
    ];
    const result = pickScope(base, existing);
    expect(result).toBe("arpan/coop#2@macbook");
  });

  it("fills gaps — reuses #2 when #2 is dead but #3 is alive", () => {
    const existing: ExistingScope[] = [
      { scope: base, status: "online", last_seen: fresh() },
      { scope: "arpan/coop#2@macbook", status: "offline", last_seen: stale() },
      { scope: "arpan/coop#3@macbook", status: "online", last_seen: fresh() },
    ];
    const result = pickScope(base, existing);
    expect(result).toBe("arpan/coop#2@macbook");
  });

  it("prefers the base scope over a dead #2", () => {
    const existing: ExistingScope[] = [
      { scope: base, status: "offline", last_seen: stale() },
      { scope: "arpan/coop#2@macbook", status: "offline", last_seen: stale() },
    ];
    const result = pickScope(base, existing);
    expect(result).toBe(base);
  });

  it("ignores scopes from other repos with similar prefixes", () => {
    const existing: ExistingScope[] = [
      { scope: "arpan/coop-frontend@macbook", status: "online", last_seen: fresh() },
    ];
    const result = pickScope(base, existing);
    expect(result).toBe(base);
  });
});
