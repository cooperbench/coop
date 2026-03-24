import { sendMessage } from "../../db/messages.ts";
import { deriveScope } from "../../session/scope.ts";

export async function send(toScope: string, body: string): Promise<void> {
  const scope = deriveScope();
  await sendMessage(scope.full, toScope, body);
  console.log(`  \x1b[32m✓\x1b[0m Sent to ${toScope}`);
}
