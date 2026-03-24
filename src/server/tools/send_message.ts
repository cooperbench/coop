import { z } from "zod";
import { sendMessage } from "../../db/messages.ts";
import { getSquadMemberStatus } from "../../db/squad.ts";

export const sendMessageTool = {
  name: "send_message",
  description: "Send a message to one or more Claude Code sessions by scope.",
  inputSchema: {
    type: "object" as const,
    properties: {
      to: {
        oneOf: [
          { type: "string", description: "Single target scope, e.g. 'arpan/coop@macbook'" },
          { type: "array", items: { type: "string" }, description: "Multiple target scopes" },
        ],
      },
      body: { type: "string", description: "Message content" },
    },
    required: ["to", "body"],
  },
  schema: z.object({ to: z.union([z.string(), z.array(z.string())]), body: z.string() }),
  async handler(args: { to: string | string[]; body: string }, fromScope: string): Promise<string> {
    const scopes = Array.isArray(args.to) ? args.to : [args.to];
    const results: string[] = [];

    for (const scope of scopes) {
      const status = await getSquadMemberStatus(scope);
      if (status === null) {
        results.push(`${scope}: not found — they may need to grant you access first`);
      } else if (status === "offline") {
        results.push(`${scope}: offline`);
      } else {
        await sendMessage(fromScope, scope, args.body);
        results.push(`${scope}: sent`);
      }
    }

    return results.join("\n");
  },
};
