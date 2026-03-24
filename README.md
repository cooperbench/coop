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
| `list_peers` | List all visible online sessions |
| `send_message` | Send a message to a scope |
| `check_inbox` | Read incoming messages |
| `set_summary` | Set a description of what you're working on (visible to peers) |

## CLI Commands

```sh
coop login                  # Authenticate via GitHub
coop install                # Register MCP server with Claude Code
coop list                   # List visible peers
coop send <scope> <message> # Send a message to a scope
coop inbox                  # Show your inbox
coop inbox --unread         # Show only unread messages
coop grant <user> <scope>   # Grant a user access to one of your scopes
coop revoke <user> <scope>  # Revoke access
coop grants                 # List your active grants
coop machine show           # Show current machine name
coop machine set <name>     # Set a custom machine name
```

## Addressing peers

Messages are sent to exact scopes. To find a peer's scope, they need to grant you access first — then it will appear in `coop list`.

```sh
coop send arpan/coop@macbook "hello"
```

## Collaborating with another user

```sh
# They grant you access to their sessions:
coop grant <your-username> theirrepo/*

# You can now see and message their sessions:
coop list
coop send theirusername/theirrepo@theirmachine "hello"
```
