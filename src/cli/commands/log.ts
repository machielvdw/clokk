import { defineCommand } from "citty";
import { getContext } from "@/cli/context.ts";
import { logEntry } from "@/core/entries.ts";
import { success } from "@/cli/output.ts";
import { formatEntry } from "@/cli/format.ts";
import { parseTags, parseDateArg, parseDurationArg } from "@/cli/parse.ts";
import type { Entry } from "@/core/types.ts";

export default defineCommand({
  meta: {
    name: "log",
    description: "Log a completed time entry",
  },
  args: {
    description: {
      type: "positional",
      description: "What you worked on",
      required: false,
    },
    project: {
      type: "string",
      alias: "p",
      description: "Project name or ID",
    },
    from: {
      type: "string",
      description: "Start time (required)",
      required: true,
    },
    to: {
      type: "string",
      description: "End time (mutually exclusive with --duration)",
    },
    duration: {
      type: "string",
      description: "Duration (mutually exclusive with --to)",
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
  },
  async run({ args }) {
    const { repo } = await getContext();
    const entry = await logEntry(repo, {
      description: args.description as string | undefined,
      project: args.project,
      from: parseDateArg(args.from),
      to: args.to ? parseDateArg(args.to) : undefined,
      duration: args.duration ? parseDurationArg(args.duration) : undefined,
      tags: args.tags ? parseTags(args.tags) : undefined,
      billable: args.billable,
    });
    success(entry, "Entry logged.", (d) => formatEntry(d as Entry));
  },
});
