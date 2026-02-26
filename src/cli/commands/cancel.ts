import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "cancel",
    description: "Discard the currently running timer",
  },
  args: {
    yes: {
      type: "boolean",
      alias: "y",
      description: "Skip confirmation",
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
    },
  },
  run({ args }) {
    console.log("TODO: cancel timer", args);
  },
});
