#!/usr/bin/env bun
import { Command } from "commander";
import { login } from "./commands/login.ts";
import { list } from "./commands/list.ts";
import { send } from "./commands/send.ts";
import { grant, revoke, grants } from "./commands/grant.ts";
import { install } from "./commands/install.ts";
import { machineShow, machineSet } from "./commands/machine.ts";

const program = new Command("claude-coop")
  .description("Peer messaging for Claude Code sessions")
  .version("0.1.0");

program.command("login").description("Authenticate via GitHub").action(login);

program.command("list").description("List visible peers").action(list);

program
  .command("send <scope> <message>")
  .description("Send a message to a scope")
  .action(send);

program
  .command("grant <user> <scope>")
  .description("Grant a user access to one of your scopes")
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
