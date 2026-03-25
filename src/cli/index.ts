#!/usr/bin/env bun
import { Command } from "commander";
import { login } from "./commands/login.ts";
import { list } from "./commands/list.ts";
import { grant, revoke, grants } from "./commands/grant.ts";
import { install } from "./commands/install.ts";
import { machineShow, machineSet } from "./commands/machine.ts";
import { whoami } from "./commands/whoami.ts";
import { inbox } from "./commands/inbox.ts";

const program = new Command("claude-coop")
  .description("Peer messaging for Claude Code sessions")
  .version("0.1.13");

program.command("login").description("Authenticate via GitHub").action(login);

program.command("whoami").description("Show current auth and scope").action(whoami);

program.command("list").description("List visible peers").action(list);

program
  .command("inbox")
  .description("Show incoming messages (unread by default)")
  .option("-a, --all", "show all messages including read", false)
  .action((opts) => inbox({ all: opts.all }));

program
  .command("grant <user> [scope]")
  .description("Grant a user access to your scopes (interactive if scope omitted)")
  .action(grant);

program
  .command("revoke <user> <scope>")
  .description("Revoke a user's access to a scope")
  .action(revoke);

program.command("grants").description("List your active grants").action(grants);

program.command("install").description("Register with Claude Code").action(install);

const machine = program.command("machine").description("Manage machine identity");
machine.command("show").description("Show current machine name").action(machineShow);
machine.command("set <name>").description("Set a custom machine name").action(machineSet);

program.parseAsync();
