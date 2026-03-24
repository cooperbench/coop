import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { execFileSync } from "child_process";
import { deriveScope } from "../session/scope.ts";
import { generateSummary } from "../session/summary.ts";
import { registerPeer, updatePeerStatus, heartbeat } from "../db/peers.ts";
import { getClient } from "../db/client.ts";
import { HEARTBEAT_INTERVAL_MS } from "../config.ts";
import { listPeersTool } from "./tools/list_peers.ts";
import { sendMessageTool } from "./tools/send_message.ts";
import { checkInboxTool } from "./tools/check_inbox.ts";
import { setSummaryTool } from "./tools/set_summary.ts";
import type { Message } from "../types.ts";

function notify(title: string, body: string): void {
  try {
    const safe = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    execFileSync("osascript", ["-e", `display notification "${safe(body)}" with title "${safe(title)}"`], { stdio: "ignore" });
  } catch { /* non-macOS or notification denied */ }
}

const tools = [listPeersTool, sendMessageTool, checkInboxTool, setSummaryTool];

async function main(): Promise<void> {
  const scope = deriveScope();
  const summary = generateSummary();

  await registerPeer(scope.full, summary);

  const heartbeatInterval = setInterval(() => heartbeat(scope.full), HEARTBEAT_INTERVAL_MS);

  async function shutdown(): Promise<void> {
    clearInterval(heartbeatInterval);
    await updatePeerStatus(scope.full, "offline");
    process.exit(0);
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const server = new Server(
    { name: "coop", version: "0.1.0" },
    {
      capabilities: {
        tools: {},
        experimental: { "claude/channel": {} },
      },
    }
  );

  // Subscribe to inbound messages via Supabase Realtime and push into Claude via channel
  getClient()
    .channel(`inbox:${scope.full}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `to_scope=eq.${scope.full}` },
      async (payload) => {
        const msg = payload.new as Message;
        notify("coop", `${msg.from_scope}: ${msg.body}`);
        await server.notification({
          method: "notifications/claude/channel",
          params: {
            content: `Message from ${msg.from_scope}:\n${msg.body}`,
            meta: { from_scope: msg.from_scope, message_id: msg.id },
          },
        });
      }
    )
    .subscribe();

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
