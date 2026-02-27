import { defineCommand } from "citty";
import { getContext } from "@/cli/context.ts";
import { getStatus } from "@/core/timer.ts";
import { success } from "@/cli/output.ts";
import { formatStatus } from "@/cli/format.ts";
import type { StatusResult } from "@/core/types.ts";

export default defineCommand({
  meta: {
    name: "status",
    description: "Show current timer status",
  },
  args: {},
  async run() {
    const { repo } = await getContext();
    const result = await getStatus(repo);
    success(result, result.running ? "Timer is running." : "No timer running.", (d) => formatStatus(d as StatusResult));
  },
});
