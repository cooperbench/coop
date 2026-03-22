import { execSync } from "child_process";
import { readFileSync } from "fs";
import type { ScopeInfo, AuthSession } from "../types.ts";
import { AUTH_FILE, getMachineName } from "../config.ts";

function gitOutput(cmd: string): string | null {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

function parseRepoName(remoteUrl: string): string {
  // Handles both SSH (git@github.com:org/repo.git) and HTTPS (https://github.com/org/repo.git)
  // Returns only the repo name, not the org
  const match = remoteUrl.match(/\/([^/]+?)(?:\.git)?$/);
  return match?.[1] ?? remoteUrl;
}

function getUsername(): string {
  try {
    const store = JSON.parse(readFileSync(AUTH_FILE, "utf8")) as Record<string, string>;
    // Supabase stores session under "sb-<project-ref>-auth-token" key
    const sessionKey = Object.keys(store).find((k) => k.includes("-auth-token"));
    if (!sessionKey) return "unknown";
    const session = JSON.parse(store[sessionKey]) as AuthSession;
    return session.user.user_metadata.user_name;
  } catch {
    return "unknown";
  }
}

export function deriveScope(): ScopeInfo {
  const remote = gitOutput("git remote get-url origin");
  const repo = remote
    ? parseRepoName(remote)
    : process.cwd().split("/").pop() ?? "unknown";
  const username = getUsername();
  const machine = getMachineName();

  return {
    username,
    repo,
    machine,
    full: `${username}/${repo}@${machine}`,
  };
}
