import { z } from "zod";
import { sendMessage } from "../../db/messages.ts";
import { getSquadMemberStatus } from "../../db/squad.ts";

export const sendMessageTool = {
  name: "send_message",
  description: "Send a message to another Claude Code session by scope.",
  inputSchema: {
    type: "object" as const,
    properties: {
      to_scope: { type: "string", description: "Target scope, e.g. 'arpan/coop@macbook'" },
      body: { type: "string", description: "Message content" },
    },
    required: ["to_scope", "body"],
  },
  schema: z.object({ to_scope: z.string(), body: z.string() }),
  async handler(args: { to_scope: string; body: string }, fromScope: string): Promise<string> {
    const status = await getSquadMemberStatus(args.to_scope);
    if (status !== "online") return `${args.to_scope} is offline`;

    await sendMessage(fromScope, args.to_scope, args.body);
    return `Message sent to ${args.to_scope}`;
  },
};
