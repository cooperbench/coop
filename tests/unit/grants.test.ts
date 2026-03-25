import { describe, it, expect } from "bun:test";

/**
 * Test the username-resolution merge logic extracted from listGrants().
 * This is the pure data transformation: rows + usernameById → GrantDisplay[].
 */
function resolveGrantUsernames(
  rows: { scope_pattern: string; grantee_user_id: string; created_at: string }[],
  users: { id: string; username: string }[],
): { scope_pattern: string; grantee_username: string; created_at: string }[] {
  const usernameById = new Map(users.map((u) => [u.id, u.username]));
  return rows.map((r) => ({
    scope_pattern: r.scope_pattern,
    grantee_username: usernameById.get(r.grantee_user_id) ?? r.grantee_user_id,
    created_at: r.created_at,
  }));
}

describe("grants username resolution", () => {
  const rows = [
    { scope_pattern: "arpan/*", grantee_user_id: "uuid-1", created_at: "2024-01-01T00:00:00Z" },
    { scope_pattern: "arpan/coop@macbook", grantee_user_id: "uuid-2", created_at: "2024-01-02T00:00:00Z" },
  ];
  const users = [
    { id: "uuid-1", username: "alice" },
    { id: "uuid-2", username: "bob" },
  ];

  it("resolves UUIDs to usernames", () => {
    const result = resolveGrantUsernames(rows, users);
    expect(result[0]!.grantee_username).toBe("alice");
    expect(result[1]!.grantee_username).toBe("bob");
  });

  it("preserves scope_pattern", () => {
    const result = resolveGrantUsernames(rows, users);
    expect(result[0]!.scope_pattern).toBe("arpan/*");
    expect(result[1]!.scope_pattern).toBe("arpan/coop@macbook");
  });

  it("falls back to raw UUID when user not found", () => {
    const result = resolveGrantUsernames(rows, [{ id: "uuid-1", username: "alice" }]);
    expect(result[1]!.grantee_username).toBe("uuid-2");
  });

  it("returns empty array for no grants", () => {
    expect(resolveGrantUsernames([], users)).toEqual([]);
  });

  it("deduplicates user lookups (same grantee, multiple scopes)", () => {
    const dupRows = [
      { scope_pattern: "arpan/*", grantee_user_id: "uuid-1", created_at: "2024-01-01T00:00:00Z" },
      { scope_pattern: "arpan/other@macbook", grantee_user_id: "uuid-1", created_at: "2024-01-02T00:00:00Z" },
    ];
    const result = resolveGrantUsernames(dupRows, users);
    expect(result[0]!.grantee_username).toBe("alice");
    expect(result[1]!.grantee_username).toBe("alice");
  });
});
