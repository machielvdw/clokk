import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "export",
    description: "Export time entries to a file",
  },
  args: {
    format: {
      type: "string",
      description: "Export format: csv, json (default: csv)",
    },
    output: {
      type: "string",
      alias: "o",
      description: "File path (default: stdout)",
    },
    project: {
      type: "string",
      alias: "p",
      description: "Filter by project",
    },
    from: {
      type: "string",
      description: "Start date",
    },
    to: {
      type: "string",
      description: "End date",
    },
    week: {
      type: "boolean",
      description: "This week's entries",
    },
    month: {
      type: "boolean",
      description: "This month's entries",
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
    },
  },
  run({ args }) {
    console.log("TODO: export entries", args);
  },
});
