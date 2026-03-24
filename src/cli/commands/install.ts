import { execSync } from "child_process";
import { resolve } from "path";
import { fileURLToPath } from "url";

export async function install(): Promise<void> {
  const thisFile = fileURLToPath(import.meta.url);
  const repoRoot = resolve(thisFile, "../../../../");
  const serverPath = resolve(repoRoot, "src/server/index.ts");

  const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
  const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
  const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

  // Preflight: verify claude CLI is reachable
  try {
    execSync("claude --version", { stdio: "pipe" });
  } catch {
    console.error(`  ${red("✗")} Claude Code CLI not found. Install it first: https://docs.anthropic.com/en/docs/claude-code`);
    process.exit(1);
  }

  process.stdout.write(`  Registering with Claude Code...`);
  try {
    // Remove any previous registration (ignore errors if none exists)
    try {
      execSync("claude mcp remove claude-coop", { stdio: "pipe" });
    } catch { /* nothing to remove */ }

    execSync(`claude mcp add --scope user claude-coop -- bun ${serverPath}`, {
      stdio: "pipe",
    });
  } catch (err) {
    process.stdout.write("\n");
    const detail = err instanceof Error && "stderr" in err ? String((err as any).stderr).trim() : "";
    console.error(`  ${red("✗")} Failed to register MCP server.${detail ? `\n  ${detail}` : ""}`);
    process.exit(1);
  }

  process.stdout.write(`\r  ${green("✓")} Registered with Claude Code\n`);
  console.log(`\n  ${dim("Restart Claude Code to activate claude-coop.")}\n`);
}
