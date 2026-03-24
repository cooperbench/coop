import { getClient } from "./client.ts";
import type { SquadMember, PeerStatus } from "../types.ts";

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
  return data as SquadMember[];
}

export async function getSquadMemberStatus(scope: string): Promise<PeerStatus | null> {
  const { data, error } = await getClient()
    .from("visible_squad")
    .select("status, last_seen")
    .eq("scope", scope)
    .single();

  if (error || !data) return null;
  const row = data as { status: PeerStatus; last_seen: string };

  // Treat as offline if last heartbeat was more than 2 minutes ago
  const stale = Date.now() - new Date(row.last_seen).getTime() > 2 * 60 * 1000;
  return stale ? "offline" : row.status;
}
