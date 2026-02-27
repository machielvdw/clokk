import { defineCommand } from "citty";
import { getContext } from "@/cli/context.ts";
import { switchTimer } from "@/core/timer.ts";
import { success } from "@/cli/output.ts";
import { formatEntry } from "@/cli/format.ts";
import { parseTags } from "@/cli/parse.ts";
import type { SwitchResult } from "@/core/types.ts";

export default defineCommand({
  meta: {
    name: "switch",
    description: "Stop current timer and start a new one",
  },
  args: {
    description: {
      type: "positional",
      description: "What you're switching to",
      required: true,
    },
    project: {
      type: "string",
      alias: "p",
      description: "Project name or ID",
    },
    tags: {
      type: "string",
      alias: "t",
      description: "Tags (comma-separated)",
    },
  },
  async run({ args }) {
    const { repo } = getContext();
    const result = await switchTimer(repo, {
      description: args.description,
      project: args.project,
      tags: args.tags ? parseTags(args.tags) : undefined,
    });
    success(result, "Switched timers.", (d) => {
      const r = d as SwitchResult;
      return `Stopped:\n${formatEntry(r.stopped)}\n\nStarted:\n${formatEntry(r.started)}`;
    });
  },
});
