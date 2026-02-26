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
      description: "Add/update tags on stop",
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
    },
  },
  run({ args }) {
    console.log("TODO: stop timer", args);
  },
});
