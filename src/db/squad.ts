import { getClient } from "./client.ts";
import { PEER_TIMEOUT_MS } from "../config.ts";
import type { SquadMember, PeerStatus } from "../types.ts";

/** Pure function — returns "offline" if last_seen is older than PEER_TIMEOUT_MS. */
export function effectiveStatus(status: PeerStatus, lastSeen: string): PeerStatus {
  return Date.now() - new Date(lastSeen).getTime() > PEER_TIMEOUT_MS ? "offline" : status;
}

export async function registerSquadMember(scope: string, summary: string | null): Promise<SquadMember> {
  const client = getClient();

  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated. Run `claude-coop login` first.");

  const username = user.user_metadata.user_name as string;
  if (!scope.startsWith(`${username}/`)) {
    throw new Error(`Scope must start with your username: ${username}/`);
  }

  const { data, error } = await client
    .from("squad")
    .upsert({ user_id: user.id, scope, status: "online", summary, last_seen: new Date().toISOString() }, { onConflict: "scope" })
    .select()
    .single();

  if (error) throw new Error(`Failed to register: ${error.message}`);
  return data as SquadMember;
}

export async function updateSquadStatus(scope: string, status: PeerStatus): Promise<void> {
  const { error } = await getClient()
    .from("squad")
    .update({ status, last_seen: new Date().toISOString() })
    .eq("scope", scope);

  if (error) throw new Error(`Failed to update status: ${error.message}`);
}

export async function updateSquadSummary(scope: string, summary: string): Promise<void> {
  const { data, error } = await getClient()
    .from("squad")
    .update({ summary })
    .eq("scope", scope)
    .select();

  if (error) throw new Error(`Failed to update summary: ${error.message}`);
  if (!data || data.length === 0) throw new Error(`No squad member found for scope: ${scope}`);
}

export async function heartbeat(scope: string): Promise<void> {
  const { error } = await getClient()
    .from("squad")
    .update({ last_seen: new Date().toISOString() })
    .eq("scope", scope);

  if (error) throw new Error(`Failed to heartbeat: ${error.message}`);
}

export async function listSquad(): Promise<SquadMember[]> {
  const { data, error } = await getClient()
    .from("visible_squad")
    .select("*")
    .order("status", { ascending: false })
    .order("last_seen", { ascending: false });

  if (error) throw new Error(`Failed to list squad: ${error.message}`);
  return (data as SquadMember[])
    .map((m) => ({ ...m, status: effectiveStatus(m.status, m.last_seen) }))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "online" ? -1 : 1;
      return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime();
    });
}

export async function listOwnScopes(): Promise<SquadMember[]> {
  const { data: { user }, error: userError } = await getClient().auth.getUser();
  if (userError || !user) throw new Error("Not authenticated. Run `claude-coop login` first.");

  const { data, error } = await getClient()
    .from("squad")
    .select("*")
    .eq("user_id", user.id)
    .order("last_seen", { ascending: false });

  if (error) throw new Error(`Failed to list own scopes: ${error.message}`);
  return (data as SquadMember[]).map((m) => ({ ...m, status: effectiveStatus(m.status, m.last_seen) }));
}

export async function findScopesWithPrefix(baseScope: string): Promise<{ scope: string; status: PeerStatus; last_seen: string }[]> {
  // Format is "user/repo@machine" — numbered variants are "user/repo#N@machine"
  // Match the base scope itself plus any "user/repo#%@machine" variants
  const atIdx = baseScope.lastIndexOf("@");
  const escaped = baseScope.replace(/%/g, "\\%").replace(/_/g, "\\_");

  let likePattern: string;
  if (atIdx === -1) {
    likePattern = `${escaped}#%`;
  } else {
    const prefix = escaped.slice(0, atIdx);
    const suffix = escaped.slice(atIdx);
    likePattern = `${prefix}#%${suffix}`;
  }

  const { data, error } = await getClient()
    .from("squad")
    .select("scope, status, last_seen")
    .or(`scope.eq.${baseScope},scope.like.${likePattern}`);

  if (error) throw new Error(`Failed to query scopes: ${error.message}`);
  return (data ?? []) as { scope: string; status: PeerStatus; last_seen: string }[];
}

export async function getSquadMemberStatus(scope: string): Promise<PeerStatus | null> {
  const { data, error } = await getClient()
    .from("visible_squad")
    .select("status, last_seen")
    .eq("scope", scope)
    .single();

  if (error || !data) return null;
  const row = data as { status: PeerStatus; last_seen: string };
  return effectiveStatus(row.status, row.last_seen);
}
