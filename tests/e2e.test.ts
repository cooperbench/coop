/**
 * End-to-end tests against the live Supabase backend.
 * Requires `coop login` to have been run (~/.coop/auth.json must exist).
 *
 * These tests exercise the real DB flows: peer registration, messaging, inbox, grants.
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { registerSquadMember, updateSquadStatus, listSquad, updateSquadSummary } from "../src/db/squad.ts";
import { sendMessage, getInbox, markRead } from "../src/db/messages.ts";
import { getClient } from "../src/db/client.ts";

const TEST_SCOPE = `akhatua2/coop-e2e-test@arpanet-test`;
const OTHER_SCOPE = `akhatua2/coop-e2e-other@arpanet-test`;

async function isAuthenticated(): Promise<boolean> {
  const { data: { user } } = await getClient().auth.getUser();
  return !!user;
}

async function cleanup() {
  const client = getClient();
  await client.from("messages").delete().in("from_scope", [TEST_SCOPE, OTHER_SCOPE]);
  await client.from("messages").delete().in("to_scope", [TEST_SCOPE, OTHER_SCOPE, "akhatua2/*"]);
  await client.from("squad").delete().in("scope", [TEST_SCOPE, OTHER_SCOPE]);
}

describe("coop E2E", () => {
  beforeAll(async () => {
    const authed = await isAuthenticated();
    if (!authed) throw new Error("Not authenticated. Run `coop login` first.");
    await cleanup();
  });

  afterAll(cleanup);

  describe("peer registration", () => {
    it("registers a peer and returns it", async () => {
      const peer = await registerSquadMember(TEST_SCOPE, "e2e test session");
      expect(peer.scope).toBe(TEST_SCOPE);
      expect(peer.status).toBe("online");
      expect(peer.summary).toBe("e2e test session");
    });

    it("upserts on re-registration (no duplicate)", async () => {
      const p1 = await registerSquadMember(TEST_SCOPE, "first");
      const p2 = await registerSquadMember(TEST_SCOPE, "second");
      expect(p1.id).toBe(p2.id);
      expect(p2.summary).toBe("second");
    });

    it("updates summary", async () => {
      await registerSquadMember(TEST_SCOPE, "original");
      await updateSquadSummary(TEST_SCOPE, "updated summary");
      const members = await listSquad();
      const member = members.find((p) => p.scope === TEST_SCOPE);
      expect(member?.summary).toBe("updated summary");
    });

    it("marks peer offline", async () => {
      await registerSquadMember(TEST_SCOPE, "going offline");
      await updateSquadStatus(TEST_SCOPE, "offline");
      const members = await listSquad();
      const member = members.find((p) => p.scope === TEST_SCOPE);
      expect(member?.status).toBe("offline");
    });

    it("listSquad includes own registered scope", async () => {
      await registerSquadMember(TEST_SCOPE, "list test");
      const members = await listSquad();
      const found = members.some((p) => p.scope === TEST_SCOPE);
      expect(found).toBe(true);
    });
  });

  describe("messaging", () => {
    beforeAll(async () => {
      await registerSquadMember(TEST_SCOPE, "messaging test");
      await registerSquadMember(OTHER_SCOPE, "messaging other");
    });

    it("sends a message and returns it with an id", async () => {
      const msg = await sendMessage(OTHER_SCOPE, TEST_SCOPE, "hello from e2e");
      expect(msg.id).toBeDefined();
      expect(msg.from_scope).toBe(OTHER_SCOPE);
      expect(msg.to_scope).toBe(TEST_SCOPE);
      expect(msg.body).toBe("hello from e2e");
      expect(msg.read).toBe(false);
    });

    it("inbox contains sent message", async () => {
      await sendMessage(OTHER_SCOPE, TEST_SCOPE, "inbox check");
      const inbox = await getInbox(TEST_SCOPE, false);
      const found = inbox.find((m) => m.body === "inbox check");
      expect(found).toBeDefined();
      expect(found?.read).toBe(false);
    });

    it("markRead marks messages as read", async () => {
      const msg = await sendMessage(OTHER_SCOPE, TEST_SCOPE, "mark me read");
      await markRead([msg.id]);
      const inbox = await getInbox(TEST_SCOPE, false);
      const found = inbox.find((m) => m.id === msg.id);
      expect(found?.read).toBe(true);
    });

    it("unread_only filter excludes read messages", async () => {
      const msg = await sendMessage(OTHER_SCOPE, TEST_SCOPE, "will be read");
      await markRead([msg.id]);
      const unread = await getInbox(TEST_SCOPE, true);
      const found = unread.find((m) => m.id === msg.id);
      expect(found).toBeUndefined();
    });

    it("rejects body over 10,000 characters", async () => {
      await expect(sendMessage(OTHER_SCOPE, TEST_SCOPE, "x".repeat(10_001))).rejects.toThrow("too long");
    });

    it("rejects malformed to_scope", async () => {
      await expect(sendMessage(OTHER_SCOPE, "not-a-valid-scope!!", "hi")).rejects.toThrow("Invalid scope");
    });

    it("rejects send to scope not in visible_peers", async () => {
      await expect(sendMessage(TEST_SCOPE, "stranger/repo@othermachine", "hi")).rejects.toThrow();
    });
  });
});
