import { defineCommand } from "citty";
import { confirmAction } from "@/cli/confirm.ts";
import { getContext } from "@/cli/context.ts";
import { formatEntry } from "@/cli/format.ts";
import { success } from "@/cli/output.ts";
import { deleteEntry } from "@/core/entries.ts";
import type { Entry } from "@/core/types.ts";

export default defineCommand({
  meta: {
    name: "delete",
    description: "Delete a time entry",
  },
  args: {
    entryId: {
      type: "positional",
      description: "Entry ID to delete",
      required: true,
    },
    yes: {
      type: "boolean",
      alias: "y",
      description: "Skip confirmation prompt",
    },
  },
  async run({ args }) {
    const confirmed = await confirmAction(`Delete entry ${args.entryId}?`, { yes: args.yes });
    if (!confirmed) {
      process.exit(0);
    }
    const { repo } = await getContext();
    const entry = await deleteEntry(repo, args.entryId);
    success(entry, "Entry deleted.", (d) => formatEntry(d as Entry));
  },
});
