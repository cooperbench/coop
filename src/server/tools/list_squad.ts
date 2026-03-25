import { listSquad } from "../../db/squad.ts";
import { listActiveThreads } from "../../db/messages.ts";

export const listSquadTool = {
  name: "list_squad",
  description: "List all visible Claude Code sessions (your own + any you've been granted access to), plus active threads.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
  async handler(currentScope: string): Promise<string> {
    const [members, threads] = await Promise.all([listSquad(), listActiveThreads(currentScope)]);

    if (members.length === 0) return "No squad members found.";

    const online = members.filter((m) => m.status === "online");
    const offline = members.filter((m) => m.status !== "online");

    const parts: string[] = [];

    if (online.length > 0) {
      const onlineLines = online.map((m) => {
        const you = m.scope === currentScope ? " (you)" : "";
        return `  ${m.scope}${you}${m.summary ? ` — ${m.summary}` : ""}`;
      });
      parts.push(`online:\n${onlineLines.join("\n")}`);
    }

    if (offline.length > 0) {
      parts.push(`${offline.length} offline session${offline.length === 1 ? "" : "s"} not shown`);
    }

    if (threads.length > 0) {
      const threadLines = threads.map((t) => `  ${t.thread} — ${t.participants.join(", ") || "(just you)"}`);
      parts.push(`threads:\n${threadLines.join("\n")}`);
    }

    if (online.length === 0) {
      parts.unshift("No sessions are online right now.");
    }

    return parts.join("\n\n");
  },
};
