import { execSync } from "child_process";
import { resolve } from "path";
import { fileURLToPath } from "url";

export async function install(): Promise<void> {
  const thisFile = fileURLToPath(import.meta.url);
  const repoRoot = resolve(thisFile, "../../../../");
  const serverPath = resolve(repoRoot, "src/server/index.ts");

  const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
  const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

  process.stdout.write(`  Registering with Claude Code...`);
  try {
    execSync(`claude mcp remove claude-coop 2>/dev/null; claude mcp add --scope user claude-coop -- bun ${serverPath}`, {
      stdio: "pipe",
      shell: "/bin/zsh",
    });
  } catch {
    process.stdout.write("\n");
    console.error(`  ${"\x1b[31m✗\x1b[0m"} Failed to register. Is Claude Code installed?`);
    process.exit(1);
  }

  process.stdout.write(`\r  ${green("✓")} Registered with Claude Code\n`);
  console.log(`\n  ${dim("Restart Claude Code to activate claude-coop.")}\n`);
}
