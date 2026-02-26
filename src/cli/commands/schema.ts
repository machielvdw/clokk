import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "schema",
    description: "Output the complete CLI interface as JSON for AI agents",
  },
  args: {
    json: {
      type: "boolean",
      description: "Output as JSON",
    },
  },
  run() {
    console.log("TODO: output schema");
  },
});
