import { getClient } from "./client.ts";
import type { Message } from "../types.ts";

const MAX_BODY_LENGTH = 10_000;
const SCOPE_PATTERN = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(#\d+)?(@[a-zA-Z0-9_.-]+)?$|^\*$|^[a-zA-Z0-9_.-]+\/\*$/;

export async function sendMessage(fromScope: string, toScope: string, body: string, thread?: string): Promise<Message> {
  if (body.length > MAX_BODY_LENGTH) throw new Error(`Message too long (max ${MAX_BODY_LENGTH} characters)`);
  if (!toScope || !SCOPE_PATTERN.test(toScope)) throw new Error(`Invalid scope: ${toScope}`);

  const { data, error } = await getClient()
    .from("messages")
    .insert({ from_scope: fromScope, to_scope: toScope, body, thread: thread ?? null })
    .select()
    .single();

  if (error) throw new Error(`Failed to send message: ${error.message}`);
  return data as Message;
}

export async function upsertThreadMembers(thread: string, scopes: string[], addedBy: string): Promise<void> {
  const { error } = await getClient().rpc("add_thread_members", {
    p_thread: thread,
    p_scopes: scopes,
    p_added_by: addedBy,
  });
  if (error) throw new Error(`Failed to update thread members: ${error.message}`);
}

export async function getThreadMembers(thread: string, myScope: string): Promise<string[]> {
  const { data, error } = await getClient()
    .from("thread_members")
    .select("scope")
    .eq("thread", thread);
  if (error || !data) return [];
  return (data as { scope: string }[]).map((r) => r.scope).filter((s) => s !== myScope);
}

export async function listActiveThreads(myScope: string): Promise<{ thread: string; participants: string[] }[]> {
  const { data, error } = await getClient()
    .from("thread_members")
    .select("thread, scope")
    .order("thread");
  if (error || !data) return [];

  const threadMap = new Map<string, string[]>();
  for (const row of data as { thread: string; scope: string }[]) {
    if (!threadMap.has(row.thread)) threadMap.set(row.thread, []);
    if (row.scope !== myScope) threadMap.get(row.thread)!.push(row.scope);
  }

  return [...threadMap.entries()].map(([thread, participants]) => ({ thread, participants }));
}

export async function getInbox(scope: string, unreadOnly = false): Promise<Message[]> {
  let query = getClient()
    .from("messages")
    .select("*")
    .eq("to_scope", scope)
    .order("created_at", { ascending: true });

  if (unreadOnly) query = query.eq("read", false);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch inbox: ${error.message}`);
  return data as Message[];
}

export async function markRead(messageIds: string[]): Promise<void> {
  const { error } = await getClient()
    .from("messages")
    .update({ read: true })
    .in("id", messageIds);

  if (error) throw new Error(`Failed to mark messages read: ${error.message}`);
}
