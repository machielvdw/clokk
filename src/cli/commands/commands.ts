import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "commands",
    description: "List all available commands with descriptions",
  },
  args: {
    json: {
      type: "boolean",
      description: "Output as JSON",
    },
  },
  run() {
    console.log("TODO: list commands");
  },
});
