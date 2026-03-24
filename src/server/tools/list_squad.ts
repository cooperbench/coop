import { listSquad } from "../../db/squad.ts";

export const listSquadTool = {
  name: "list_squad",
  description: "List all visible Claude Code sessions (your own + any you've been granted access to).",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
  async handler(): Promise<string> {
    const members = await listSquad();
    if (members.length === 0) return "No squad members found.";

    return members
      .map((m) => {
        const status = m.status === "online" ? "online" : "offline";
        return `${m.scope} [${status}]${m.summary ? ` — ${m.summary}` : ""}`;
      })
      .join("\n");
  },
};
