import { createServer } from "http";
import { createInterface } from "readline";
import type { AddressInfo } from "net";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../../config.ts";
import { getClient } from "../../db/client.ts";

function tryOpenBrowser(url: string): boolean {
  const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
  try {
    Bun.spawn([openCmd, url], { stderr: "ignore", stdout: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Read a single line from stdin (resolves on first Enter). */
function readLine(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function login(): Promise<void> {
  // Use a temporary client for the PKCE flow (no storage yet)
  const { createClient } = await import("@supabase/supabase-js");
  const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { flowType: "pkce", persistSession: false },
  });

  // Start a local callback server — works when the browser is on the same machine
  let serverResolved = false;
  const code = await new Promise<string>((resolve, reject) => {
    let port = 0;
    const done = (code: string) => { if (!serverResolved) { serverResolved = true; server.close(); resolve(code); } };
    const fail = (err: Error) => { if (!serverResolved) { serverResolved = true; server.close(); reject(err); } };

    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>claude-coop</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0a0a0a; color: #fff; }
    .card { text-align: center; }
    h1 { font-size: 1.5rem; font-weight: 500; margin-bottom: 0.5rem; }
    p { color: #888; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You're logged in</h1>
    <p>You can close this tab and return to the terminal.</p>
  </div>
</body>
</html>`);

      if (code) done(code);
      else fail(new Error(error ?? "No code received"));
    });

    server.listen(0, () => {
      port = (server.address() as AddressInfo).port;
      const callbackUrl = `http://localhost:${port}/callback`;

      tempClient.auth
        .signInWithOAuth({
          provider: "github",
          options: { redirectTo: callbackUrl, skipBrowserRedirect: true },
        })
        .then(async ({ data, error }) => {
          if (error) { fail(error); return; }

          const opened = tryOpenBrowser(data.url);
          if (opened) {
            console.log(`\nOpening browser for authentication...`);
            console.log(`If it didn't open, visit:\n\n  ${data.url}\n`);
          } else {
            // Headless / remote VM — browser can't reach localhost callback
            console.log(`\nOpen this URL in a browser to authenticate:\n\n  ${data.url}\n`);
            console.log(`After authorizing, your browser will redirect to a localhost URL that may not load.`);
            console.log(`Copy the full URL from the address bar and paste it below.\n`);

            try {
              const pasted = await readLine("  Paste redirect URL: ");
              if (serverResolved) return; // callback server already got it
              const parsed = new URL(pasted);
              const pastedCode = parsed.searchParams.get("code");
              if (pastedCode) {
                done(pastedCode);
              } else {
                const pastedError = parsed.searchParams.get("error_description") ?? parsed.searchParams.get("error");
                fail(new Error(pastedError ?? "No code found in URL. Make sure you copied the full redirect URL."));
              }
            } catch (e) {
              if (!serverResolved) fail(e instanceof Error ? e : new Error("Invalid URL"));
            }
          }
        });
    });

    setTimeout(() => { fail(new Error("Timed out waiting for authentication (5 minutes)")); }, 5 * 60 * 1000);
  });

  // Exchange code and persist session via the shared client (which uses file storage)
  const { data: sessionData, error: sessionError } = await tempClient.auth.exchangeCodeForSession(code);
  if (sessionError) throw new Error(`Session exchange failed: ${sessionError.message}`);

  // Set session on the persistent client so it gets written to file storage
  await getClient().auth.setSession({
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
  });

  const username = sessionData.session.user.user_metadata["user_name"] as string;
  console.log(`\n  \x1b[32m✓\x1b[0m Logged in as ${username}\n`);
  process.exit(0);
}
