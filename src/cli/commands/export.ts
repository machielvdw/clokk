import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "export",
    description: "Export time entries",
  },
  args: {
    format: {
      type: "enum",
      options: ["csv", "json"],
      description: "Export format (default: csv)",
    },
    output: {
      type: "string",
      alias: "o",
      description: "Output file path (default: stdout)",
    },
    project: {
      type: "string",
      alias: "p",
      description: "Filter by project name or ID",
    },
    from: {
      type: "string",
      description: "Start of date range",
    },
    to: {
      type: "string",
      description: "End of date range",
    },
    week: {
      type: "boolean",
      description: "Export this week's entries",
    },
    month: {
      type: "boolean",
      description: "Export this month's entries",
    },
  },
  run() {
    throw new Error("Not implemented");
  },
});
