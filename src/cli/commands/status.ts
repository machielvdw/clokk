import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "status",
    description: "Show the currently running timer",
  },
  args: {
    json: {
      type: "boolean",
      description: "Output as JSON",
    },
  },
  run({ args }) {
    console.log("TODO: show status", args);
  },
});
