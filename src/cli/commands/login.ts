import { createServer } from "http";
import { createInterface } from "readline";
import type { AddressInfo } from "net";
import { SUPABASE_URL, SUPABASE_ANON_KEY, HOSTED_CALLBACK_URL } from "../../config.ts";
import { getClient } from "../../db/client.ts";

/** Check if we have a local graphical desktop that can open a browser. */
function hasLocalBrowser(): boolean {
  if (process.platform === "darwin") return true;
  if (process.platform === "linux") {
    return !!(process.env["DISPLAY"] || process.env["WAYLAND_DISPLAY"]);
  }
  return false;
}

function openBrowser(url: string): void {
  const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
  Bun.spawn([openCmd, url], { stderr: "ignore", stdout: "ignore" });
}

/** Read a single line from stdin. */
function readLine(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function exchangeAndPersist(
  tempClient: any,
  code: string,
): Promise<void> {
  const { data: sessionData, error: sessionError } = await tempClient.auth.exchangeCodeForSession(code);
  if (sessionError) throw new Error(`Session exchange failed: ${sessionError.message}`);

  await getClient().auth.setSession({
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
  });

  const username = sessionData.session.user.user_metadata["user_name"] as string;
  console.log(`\n  \x1b[32m✓\x1b[0m Logged in as ${username}\n`);
}

/**
 * Local-browser login: starts a localhost callback server.
 * Used when a browser can be opened on the same machine.
 */
async function loginLocal(
  tempClient: any,
): Promise<void> {
  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const port = (server.address() as AddressInfo).port;
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>claude-coop</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a0a0a;color:#fff}.card{text-align:center}h1{font-size:1.5rem;font-weight:500}p{color:#888;font-size:.9rem}</style>
</head><body><div class="card"><h1>You're logged in</h1><p>You can close this tab and return to the terminal.</p></div></body></html>`);
      server.close();

      if (code) resolve(code);
      else reject(new Error(error ?? "No code received"));
    });

    server.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      const callbackUrl = `http://localhost:${port}/callback`;

      tempClient.auth
        .signInWithOAuth({
          provider: "github",
          options: { redirectTo: callbackUrl, skipBrowserRedirect: true },
        })
        .then(({ data, error }: { data: any; error: any }) => {
          if (error) { server.close(); reject(error); return; }
          openBrowser(data.url);
          console.log(`\nOpening browser for authentication...`);
          console.log(`If it didn't open, visit:\n\n  ${data.url}\n`);
        });
    });

    setTimeout(() => { server.close(); reject(new Error("Timed out")); }, 5 * 60 * 1000);
  });

  await exchangeAndPersist(tempClient, code);
}

/**
 * Headless login: redirects to a hosted callback page that displays the code.
 * User copies the code and pastes it back into the terminal.
 */
async function loginHeadless(
  tempClient: any,
): Promise<void> {
  const { data, error } = await tempClient.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: HOSTED_CALLBACK_URL, skipBrowserRedirect: true },
  });
  if (error) throw error;

  console.log(`\nOpen this URL in a browser to authenticate:\n\n  ${data.url}\n`);
  console.log(`After authorizing, you'll see a code. Copy it and paste it here.\n`);

  const input = await readLine("  Paste code: ");
  if (!input) throw new Error("No code provided");

  // Accept either a raw code or a full URL containing ?code=...
  let code: string;
  try {
    const parsed = new URL(input);
    code = parsed.searchParams.get("code") ?? input;
  } catch {
    code = input;
  }

  await exchangeAndPersist(tempClient, code);
}

export async function login(): Promise<void> {
  const { createClient } = await import("@supabase/supabase-js");
  const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { flowType: "pkce", persistSession: false },
  });

  // If a local desktop is available, use the localhost callback flow.
  // Otherwise fall back to the headless flow with a hosted callback page.
  if (hasLocalBrowser()) {
    await loginLocal(tempClient);
  } else {
    await loginHeadless(tempClient);
  }

  process.exit(0);
}
