import { listSquad } from "../../db/squad.ts";

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

export async function list(): Promise<void> {
  const members = await listSquad();

  if (members.length === 0) {
    console.log(dim("No squad members found."));
    return;
  }

  for (const m of members) {
    const dot = m.status === "online" ? green("●") : dim("○");
    const summary = m.summary ? dim(`  ${m.summary}`) : "";
    console.log(`${dot} ${m.scope}${summary}`);
  }
}
