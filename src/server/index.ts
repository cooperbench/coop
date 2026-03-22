import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { deriveScope } from "../session/scope.ts";
import { generateSummary } from "../session/summary.ts";
import { registerPeer, updatePeerStatus, heartbeat } from "../db/peers.ts";
import { HEARTBEAT_INTERVAL_MS } from "../config.ts";
import { listPeersTool } from "./tools/list_peers.ts";
import { sendMessageTool } from "./tools/send_message.ts";
import { checkInboxTool } from "./tools/check_inbox.ts";
import { setSummaryTool } from "./tools/set_summary.ts";

const tools = [listPeersTool, sendMessageTool, checkInboxTool, setSummaryTool];

async function main(): Promise<void> {
  const scope = deriveScope();
  const summary = generateSummary();

  // Register this session as online
  await registerPeer(scope.full, summary);

  // Heartbeat to stay online
  const heartbeatInterval = setInterval(() => heartbeat(scope.full), HEARTBEAT_INTERVAL_MS);

  // Mark offline on exit
  async function shutdown(): Promise<void> {
    clearInterval(heartbeatInterval);
    await updatePeerStatus(scope.full, "offline");
    process.exit(0);
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // MCP server
  const server = new Server(
    { name: "coop", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = tools.find((t) => t.name === req.params.name);
    if (!tool) throw new Error(`Unknown tool: ${req.params.name}`);

    const args = req.params.arguments ?? {};
    let result: string;

    switch (tool.name) {
      case "list_peers":
        result = await listPeersTool.handler();
        break;
      case "send_message":
        result = await sendMessageTool.handler(args as { to_scope: string; body: string }, scope.full);
        break;
      case "check_inbox":
        result = await checkInboxTool.handler(args as { unread_only: boolean }, scope.full);
        break;
      case "set_summary":
        result = await setSummaryTool.handler(args as { summary: string }, scope.full);
        break;
      default:
        throw new Error(`Unhandled tool: ${tool.name}`);
    }

    return { content: [{ type: "text", text: result }] };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
