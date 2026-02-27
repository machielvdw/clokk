import { defineCommand } from "citty";
import { getContext } from "@/cli/context.ts";
import { triggerSync } from "@/core/sync.ts";
import { success } from "@/cli/output.ts";
import type { SyncResult } from "@/data/repository.ts";

export default defineCommand({
  meta: {
    name: "sync",
    description: "Trigger a manual sync with the remote database",
  },
  args: {},
  async run() {
    const { repo } = await getContext();
    const result = await triggerSync(repo);
    success(result, result.message, (d) => {
      const r = d as SyncResult;
      return r.synced ? "  Sync completed successfully." : `  ${r.message}`;
    });
  },
});
