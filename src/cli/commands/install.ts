import { execSync } from "child_process";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, cpSync, existsSync } from "fs";
import { homedir } from "os";

export async function install(): Promise<void> {
  const thisFile = fileURLToPath(import.meta.url);
  const repoRoot = resolve(thisFile, "../../../../");
  const serverPath = resolve(repoRoot, "src/server/index.ts");
  const skillsSource = resolve(repoRoot, "skills");

  const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
  const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
  const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

  // Preflight: verify claude CLI is reachable
  try {
    execSync("claude --version", { stdio: "pipe" });
  } catch {
    console.error(`  ${red("✗")} Looks like Claude Code isn't installed yet. Grab it here: https://docs.anthropic.com/en/docs/claude-code`);
    process.exit(1);
  }

  // Step 1: Register MCP server
  process.stdout.write(`  Registering MCP server...`);
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
    console.error(`  ${red("✗")} Hmm, couldn't register with Claude Code.${detail ? `\n  ${detail}` : ""}`);
    process.exit(1);
  }
  process.stdout.write(`\r  ${green("✓")} Registered MCP server\n`);

  // Step 2: Install skills to ~/.claude/skills/
  process.stdout.write(`  Installing skills...`);
  try {
    const userSkillsDir = resolve(homedir(), ".claude", "skills");
    mkdirSync(userSkillsDir, { recursive: true });

    if (existsSync(skillsSource)) {
      cpSync(skillsSource, userSkillsDir, { recursive: true, force: true });
    }
  } catch (err) {
    process.stdout.write("\n");
    const detail = err instanceof Error ? err.message : "";
    console.error(`  ${red("✗")} Failed to install skills.${detail ? `\n  ${detail}` : ""}`);
    process.exit(1);
  }
  process.stdout.write(`\r  ${green("✓")} Installed skills\n`);

  console.log(`\n  ${dim("Restart Claude Code to activate it.")}\n`);
}
