import { defineCommand } from "citty";
import { getContext } from "@/cli/context.ts";
import { startTimer } from "@/core/timer.ts";
import { success } from "@/cli/output.ts";
import { formatEntry } from "@/cli/format.ts";
import { parseTags, parseDateArg } from "@/cli/parse.ts";
import type { Entry } from "@/core/types.ts";

export default defineCommand({
  meta: {
    name: "start",
    description: "Start a new timer",
  },
  args: {
    description: {
      type: "positional",
      description: "What you're working on",
      required: false,
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
    billable: {
      type: "boolean",
      description: "Mark as billable",
    },
    at: {
      type: "string",
      description: "Override start time",
    },
  },
  async run({ args }) {
    const { repo } = getContext();
    const entry = await startTimer(repo, {
      description: args.description as string | undefined,
      project: args.project,
      tags: args.tags ? parseTags(args.tags) : undefined,
      billable: args.billable,
      at: args.at ? parseDateArg(args.at) : undefined,
    });
    success(entry, "Timer started.", (d) => formatEntry(d as Entry));
  },
});
