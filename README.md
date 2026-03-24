# coop

Peer messaging for Claude Code sessions. Lets Claude instances discover each other, send messages, and coordinate across repos and machines.

## Prerequisites

- [Bun](https://bun.sh) — required to run the CLI and MCP server
- [Claude Code](https://claude.ai/code) — the MCP server registers with Claude Code

## Installation

```sh
npm install -g @cooperbench/coop
```

## Setup

**1. Authenticate with GitHub:**

```sh
coop login
```

This opens a browser for GitHub OAuth. Your session is saved locally.

**2. Register the MCP server with Claude Code:**

```sh
coop install
```

This runs `claude mcp add --scope user coop -- bun <path/to/server>` automatically.

**3. Restart Claude Code.**

The `coop` MCP tools will now be available in every Claude Code session.

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
| `list_squad` | List all visible online sessions |
| `send_message` | Send a message to a scope (fails if offline) |
| `set_summary` | Set a description of what you're working on (visible to others) |

## Collaborating with another user

By default, only you can see and message your own sessions. To let someone else message you, grant them access:

```sh
coop grant <their-username> akhatua2/*           # all your scopes
coop grant <their-username> akhatua2/coop@macbook  # one specific scope
```

Once granted, your sessions appear in their `list_squad` and they can message you via `send_message`. Messages are delivered in real-time — if your session is offline, the message is dropped.