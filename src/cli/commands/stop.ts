import { defineCommand } from "citty";

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
  run() {
    throw new Error("Not implemented");
  },
});
