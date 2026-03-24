import { describe, it, expect } from "bun:test";
import { applyToggle, type CheckboxItem } from "../../src/cli/prompts/checkbox.ts";
import { diffGrants } from "../../src/cli/commands/grant.ts";

const items: CheckboxItem[] = [
  { label: "arpan/coop@macbook",     value: "arpan/coop@macbook" },
  { label: "arpan/other@macbook",    value: "arpan/other@macbook" },
  { label: "arpan/*  (all scopes)", value: "arpan/*", dividerBefore: true },
];

describe("applyToggle", () => {
  it("selects an unchecked item", () => {
    const checked = new Set<string>();
    applyToggle(checked, items, 0);
    expect(checked.has("arpan/coop@macbook")).toBe(true);
  });

  it("deselects a checked item", () => {
    const checked = new Set(["arpan/coop@macbook"]);
    applyToggle(checked, items, 0);
    expect(checked.has("arpan/coop@macbook")).toBe(false);
  });

  it("selecting wildcard clears all individual selections", () => {
    const checked = new Set(["arpan/coop@macbook", "arpan/other@macbook"]);
    applyToggle(checked, items, 2); // wildcard is index 2
    expect(checked.has("arpan/coop@macbook")).toBe(false);
    expect(checked.has("arpan/other@macbook")).toBe(false);
    expect(checked.has("arpan/*")).toBe(true);
  });

  it("deselecting wildcard leaves nothing checked", () => {
    const checked = new Set(["arpan/*"]);
    applyToggle(checked, items, 2);
    expect(checked.size).toBe(0);
  });

  it("selecting an individual while wildcard is active: removes wildcard, expands all others, unchecks target", () => {
    const checked = new Set(["arpan/*"]);
    // Toggle index 0 (arpan/coop@macbook) — should uncheck it, keep arpan/other@macbook checked
    applyToggle(checked, items, 0);
    expect(checked.has("arpan/*")).toBe(false);
    expect(checked.has("arpan/coop@macbook")).toBe(false);   // the toggled one is removed
    expect(checked.has("arpan/other@macbook")).toBe(true);   // all others stay checked
  });

  it("checking all individuals auto-promotes to wildcard", () => {
    const checked = new Set<string>();
    applyToggle(checked, items, 0); // arpan/coop@macbook
    applyToggle(checked, items, 1); // arpan/other@macbook — now all individuals checked
    expect(checked.has("arpan/*")).toBe(true);
    expect(checked.has("arpan/coop@macbook")).toBe(false);  // individuals cleared
    expect(checked.has("arpan/other@macbook")).toBe(false);
  });

  it("unchecking one individual when wildcard is active expands to all-minus-one", () => {
    const checked = new Set(["arpan/*"]);
    applyToggle(checked, items, 0); // uncheck arpan/coop@macbook
    expect(checked.has("arpan/*")).toBe(false);
    expect(checked.has("arpan/coop@macbook")).toBe(false);
    expect(checked.has("arpan/other@macbook")).toBe(true);
  });

  it("unchecking then re-checking all individuals re-promotes to wildcard", () => {
    const checked = new Set(["arpan/*"]);
    applyToggle(checked, items, 0); // uncheck one → expands, removes coop
    applyToggle(checked, items, 0); // re-check it → all individuals checked again
    expect(checked.has("arpan/*")).toBe(true);
  });
});

describe("diffGrants", () => {
  const existingGrants = [
    { scope_pattern: "arpan/coop@macbook", grantee_username: "alice", created_at: "" },
    { scope_pattern: "arpan/other@macbook", grantee_username: "bob",  created_at: "" },
  ];

  it("newly selected scopes go into toGrant", () => {
    const { toGrant, toRevoke } = diffGrants(["arpan/coop@macbook", "arpan/new@macbook"], existingGrants, "alice");
    expect(toGrant).toContain("arpan/new@macbook");
    expect(toRevoke).toHaveLength(0);
  });

  it("deselected previously-granted scopes go into toRevoke", () => {
    const { toGrant, toRevoke } = diffGrants([], existingGrants, "alice");
    expect(toRevoke).toContain("arpan/coop@macbook");
    expect(toGrant).toHaveLength(0);
  });

  it("already-granted scopes kept selected produce no changes", () => {
    const { toGrant, toRevoke } = diffGrants(["arpan/coop@macbook"], existingGrants, "alice");
    expect(toGrant).toHaveLength(0);
    expect(toRevoke).toHaveLength(0);
  });

  it("only diffs grants for the target grantee, not others", () => {
    // alice has arpan/coop@macbook, bob has arpan/other@macbook
    // granting alice nothing should only revoke alice's grants
    const { toRevoke } = diffGrants([], existingGrants, "alice");
    expect(toRevoke).toContain("arpan/coop@macbook");
    expect(toRevoke).not.toContain("arpan/other@macbook");
  });

  it("empty selection with no prior grants produces no changes", () => {
    const { toGrant, toRevoke } = diffGrants([], existingGrants, "charlie");
    expect(toGrant).toHaveLength(0);
    expect(toRevoke).toHaveLength(0);
  });
});
