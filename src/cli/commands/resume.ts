import { defineCommand } from "citty";
import { getContext } from "@/cli/context.ts";
import { resumeTimer } from "@/core/timer.ts";
import { success } from "@/cli/output.ts";
import { formatEntry } from "@/cli/format.ts";
import type { Entry } from "@/core/types.ts";

export default defineCommand({
  meta: {
    name: "resume",
    description: "Resume the last stopped timer",
  },
  args: {
    id: {
      type: "string",
      description: "Resume a specific entry by ID",
    },
  },
  async run({ args }) {
    const { repo } = getContext();
    const entry = await resumeTimer(repo, {
      id: args.id,
    });
    success(entry, "Timer resumed.", (d) => formatEntry(d as Entry));
  },
});
