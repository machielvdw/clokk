import { defineCommand } from "citty";
import { getContext } from "@/cli/context.ts";
import { stopTimer } from "@/core/timer.ts";
import { success } from "@/cli/output.ts";
import { formatEntry } from "@/cli/format.ts";
import { parseTags, parseDateArg } from "@/cli/parse.ts";
import type { Entry } from "@/core/types.ts";

export default defineCommand({
  meta: {
    name: "stop",
    description: "Stop the current timer",
  },
  args: {
    at: {
      type: "string",
      description: "Override stop time",
    },
    description: {
      type: "string",
      alias: "d",
      description: "Update description on stop",
    },
    tags: {
      type: "string",
      alias: "t",
      description: "Update tags on stop (comma-separated)",
    },
  },
  async run({ args }) {
    const { repo } = await getContext();
    const entry = await stopTimer(repo, {
      at: args.at ? parseDateArg(args.at) : undefined,
      description: args.description,
      tags: args.tags ? parseTags(args.tags) : undefined,
    });
    success(entry, "Timer stopped.", (d) => formatEntry(d as Entry));
  },
});
