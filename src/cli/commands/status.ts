import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "status",
    description: "Show current timer status",
  },
  args: {},
  run() {
    throw new Error("Not implemented");
  },
});
