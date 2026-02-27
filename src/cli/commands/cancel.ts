import { defineCommand } from "citty";
import { getContext } from "@/cli/context.ts";
import { cancelTimer } from "@/core/timer.ts";
import { confirmAction } from "@/cli/confirm.ts";
import { success } from "@/cli/output.ts";
import { formatEntry } from "@/cli/format.ts";
import type { Entry } from "@/core/types.ts";

export default defineCommand({
  meta: {
    name: "cancel",
    description: "Discard the running timer",
  },
  args: {
    yes: {
      type: "boolean",
      alias: "y",
      description: "Skip confirmation prompt",
    },
  },
  async run({ args }) {
    const confirmed = await confirmAction(
      "Discard the running timer?",
      { yes: args.yes },
    );
    if (!confirmed) {
      process.exit(0);
    }
    const { repo } = await getContext();
    const entry = await cancelTimer(repo);
    success(entry, "Timer cancelled.", (d) => formatEntry(d as Entry));
  },
});
