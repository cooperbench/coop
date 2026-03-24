import { z } from "zod";
import { updateSquadSummary } from "../../db/squad.ts";

export const setSummaryTool = {
  name: "set_summary",
  description: "Update your session summary so other peers know what you're working on.",
  inputSchema: {
    type: "object" as const,
    properties: {
      summary: { type: "string", description: "Brief description of what this session is doing" },
    },
    required: ["summary"],
  },
  schema: z.object({ summary: z.string() }),
  async handler(args: { summary: string }, scope: string): Promise<string> {
    await updateSquadSummary(scope, args.summary);
    return `Summary updated.`;
  },
};
