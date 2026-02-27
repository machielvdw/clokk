import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "report",
    description: "Generate a time report",
  },
  args: {
    project: {
      type: "string",
      alias: "p",
      description: "Filter by project name or ID",
    },
    tags: {
      type: "string",
      alias: "t",
      description: "Filter by tags (comma-separated)",
    },
    from: {
      type: "string",
      description: "Start of date range",
    },
    to: {
      type: "string",
      description: "End of date range",
    },
    today: {
      type: "boolean",
      description: "Report for today",
    },
    yesterday: {
      type: "boolean",
      description: "Report for yesterday",
    },
    week: {
      type: "boolean",
      description: "Report for this week (default)",
    },
    month: {
      type: "boolean",
      description: "Report for this month",
    },
    "group-by": {
      type: "enum",
      options: ["project", "tag", "day", "week"],
      description: "Group entries by (default: project)",
    },
  },
  run() {
    throw new Error("Not implemented");
  },
});
