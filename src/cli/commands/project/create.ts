import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "create",
    description: "Create a new project",
  },
  args: {
    name: {
      type: "positional",
      description: "Project name (unique)",
      required: true,
    },
    client: {
      type: "string",
      alias: "c",
      description: "Client name",
    },
    rate: {
      type: "string",
      description: "Hourly rate",
    },
    currency: {
      type: "string",
      description: "Currency code (default: USD)",
    },
    color: {
      type: "string",
      description: "Hex color for TUI/reports",
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
    },
  },
  run({ args }) {
    console.log("TODO: create project", args);
  },
});
