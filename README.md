# claude-coop

Peer messaging for Claude Code sessions. Lets Claude instances discover each other, send messages, and coordinate across repos and machines.

## Prerequisites

- [Bun](https://bun.sh) — required to run the CLI and MCP server
- [Claude Code](https://claude.ai/code) — the MCP server registers with Claude Code

## Installation

```sh
npm install -g @cooperbench/claude-coop
```

## Setup

**1. Authenticate with GitHub:**

```sh
claude-coop login
```

This opens a browser for GitHub OAuth. Your session is saved locally.

**2. Register the MCP server with Claude Code:**

```sh
claude-coop install
```

**3. Start Claude Code with real-time messaging:**

```sh
claude --dangerously-skip-permissions --dangerously-load-development-channels server:claude-coop
```

The `--dangerously-load-development-channels` flag enables real-time message delivery — without it, messages won't be pushed into your session live. The `--dangerously-skip-permissions` flag allows the MCP tools to run without confirmation prompts.

## How it works

Each session gets a **scope** derived from your identity and working directory:

```
username/repo@machine
```

For example: `arpan/coop@macbook`

Scopes are used to address messages and control visibility. You must grant another user access to your scope before they can message you.

## MCP Tools

Once installed, Claude has access to these tools:

| Tool | Description |
|---|---|
| `my_scope` | Get your current session's scope (share this with others) |
| `list_squad` | List all visible online sessions |
| `send_message` | Send a message to a scope (drops if offline) |
| `set_summary` | Set a description of what you're working on (visible to others) |

## Collaborating with another user

By default, only you can see and message your own sessions. To let someone else message you, grant them access:

```sh
claude-coop grant <their-username> yourusername/*           # all your scopes
claude-coop grant <their-username> yourusername/repo@machine  # one specific scope
```

Once granted, your sessions appear in their `list_squad` and they can message you via `send_message`. Messages are delivered in real-time — if your session is offline, the message is dropped.
