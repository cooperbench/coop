import { execSync } from "child_process";
import { resolve } from "path";
import { fileURLToPath } from "url";

export async function install(): Promise<void> {
  const thisFile = fileURLToPath(import.meta.url);
  const repoRoot = resolve(thisFile, "../../../../");
  const serverPath = resolve(repoRoot, "src/server/index.ts");

  try {
    execSync(`claude mcp remove coop 2>/dev/null; claude mcp add --scope user coop -- bun ${serverPath}`, {
      stdio: "inherit",
      shell: "/bin/zsh",
    });
  } catch {
    console.error("Failed to register MCP server. Is Claude Code installed?");
    process.exit(1);
  }

  console.log("\nDone. Restart Claude Code to activate coop.");
}
