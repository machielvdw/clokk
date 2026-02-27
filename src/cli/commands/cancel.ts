import { defineCommand } from "citty";

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
  run() {
    throw new Error("Not implemented");
  },
});
