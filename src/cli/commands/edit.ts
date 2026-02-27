import { defineCommand } from "citty";
import { getContext } from "@/cli/context.ts";
import { editEntry } from "@/core/entries.ts";
import { success } from "@/cli/output.ts";
import { formatEntry } from "@/cli/format.ts";
import { parseTags, parseDateArg } from "@/cli/parse.ts";
import type { Entry } from "@/core/types.ts";

export default defineCommand({
  meta: {
    name: "edit",
    description: "Edit an existing time entry",
  },
  args: {
    entryId: {
      type: "positional",
      description: "Entry ID to edit",
      required: true,
    },
    description: {
      type: "string",
      alias: "d",
      description: "New description",
    },
    project: {
      type: "string",
      alias: "p",
      description: "New project name or ID",
    },
    from: {
      type: "string",
      description: "New start time",
    },
    to: {
      type: "string",
      description: "New end time",
    },
    tags: {
      type: "string",
      alias: "t",
      description: "New tags (comma-separated)",
    },
    billable: {
      type: "boolean",
      description: "Set billable status",
    },
  },
  async run({ args }) {
    const { repo } = await getContext();
    const entry = await editEntry(repo, args.entryId, {
      description: args.description,
      project: args.project,
      start_time: args.from ? parseDateArg(args.from) : undefined,
      end_time: args.to ? parseDateArg(args.to) : undefined,
      tags: args.tags ? parseTags(args.tags) : undefined,
      billable: args.billable,
    });
    success(entry, "Entry updated.", (d) => formatEntry(d as Entry));
  },
});
