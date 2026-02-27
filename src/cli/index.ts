import type { CommandDef, ArgsDef, SubCommandsDef } from "citty";
import { defineCommand, runCommand, showUsage } from "citty";
import { ClokkError, DatabaseError } from "@/core/errors.ts";
import { error as outputError, detectOutputMode } from "@/cli/output.ts";

const VERSION = "0.1.0";

export const main = defineCommand({
  meta: {
    name: "clokk",
    version: VERSION,
    description: "A local-first CLI time tracker built for humans and AI agents",
  },
  args: {
    json: {
      type: "boolean",
      description: "Force JSON output",
    },
    human: {
      type: "boolean",
      description: "Force human-readable output",
    },
    yes: {
      type: "boolean",
      alias: "y",
      description: "Skip confirmation prompts",
    },
  },
  subCommands: {
    start: () => import("@/cli/commands/start.ts").then((m) => m.default),
    stop: () => import("@/cli/commands/stop.ts").then((m) => m.default),
    status: () => import("@/cli/commands/status.ts").then((m) => m.default),
    resume: () => import("@/cli/commands/resume.ts").then((m) => m.default),
    switch: () => import("@/cli/commands/switch.ts").then((m) => m.default),
    cancel: () => import("@/cli/commands/cancel.ts").then((m) => m.default),
    log: () => import("@/cli/commands/log.ts").then((m) => m.default),
    edit: () => import("@/cli/commands/edit.ts").then((m) => m.default),
    delete: () => import("@/cli/commands/delete.ts").then((m) => m.default),
    list: () => import("@/cli/commands/list.ts").then((m) => m.default),
    project: () => import("@/cli/commands/project.ts").then((m) => m.default),
    report: () => import("@/cli/commands/report.ts").then((m) => m.default),
    export: () => import("@/cli/commands/export.ts").then((m) => m.default),
    config: () => import("@/cli/commands/config.ts").then((m) => m.default),
    schema: () => import("@/cli/commands/schema.ts").then((m) => m.default),
    commands: () => import("@/cli/commands/commands.ts").then((m) => m.default),
  },
});

/**
 * Walk the subcommand tree to find the deepest matching command for --help.
 * citty's resolveSubCommand is not exported, so we implement our own.
 */
async function resolveDeepCommand(
  cmd: CommandDef<ArgsDef>,
  rawArgs: string[],
): Promise<CommandDef<ArgsDef>> {
  const rawSubs = typeof cmd.subCommands === "function"
    ? await cmd.subCommands()
    : cmd.subCommands;
  const subCommands = rawSubs as SubCommandsDef | undefined;

  if (!subCommands || Object.keys(subCommands).length === 0) return cmd;

  const subIdx = rawArgs.findIndex((a) => !a.startsWith("-"));
  if (subIdx === -1) return cmd;

  const subName = rawArgs[subIdx]!;
  const subDef = subCommands[subName];
  if (!subDef) return cmd;

  const resolved = typeof subDef === "function"
    ? await (subDef as () => Promise<CommandDef<ArgsDef>>)()
    : subDef;
  if (!resolved) return cmd;

  return resolveDeepCommand(resolved as CommandDef<ArgsDef>, rawArgs.slice(subIdx + 1));
}

function getOutputMode(rawArgs: string[]) {
  return detectOutputMode({
    json: rawArgs.includes("--json"),
    human: rawArgs.includes("--human"),
  });
}

async function run(): Promise<void> {
  const rawArgs = process.argv.slice(2);

  try {
    // --help / -h: resolve deepest subcommand and show its usage
    if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
      const helpArgs = rawArgs.filter((a) => a !== "--help" && a !== "-h");
      const resolved = await resolveDeepCommand(main as CommandDef<ArgsDef>, helpArgs);
      await showUsage(resolved);
      process.exit(0);
    }

    // --version (only when it's the sole argument)
    if (rawArgs.length === 1 && rawArgs[0] === "--version") {
      console.log(VERSION);
      process.exit(0);
    }

    await runCommand(main, { rawArgs });
  } catch (err) {
    // ClokkError: format as JSON envelope or human error, exit with err.exitCode
    if (err instanceof ClokkError) {
      outputError(err, undefined, { mode: getOutputMode(rawArgs) });
    }

    // citty's CLIError (unknown command, missing required arg, etc.)
    if (err instanceof Error && err.name === "CLIError") {
      await showUsage(main);
      console.error(err.message);
      process.exit(1);
    }

    // Unknown/system error: wrap and format
    const wrapped =
      err instanceof Error
        ? new DatabaseError(err.message, err)
        : new DatabaseError(String(err));
    outputError(wrapped, undefined, { mode: getOutputMode(rawArgs) });
  }
}

run();
