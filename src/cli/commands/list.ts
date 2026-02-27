import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "list",
    description: "List time entries",
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
      description: "Show today's entries",
    },
    yesterday: {
      type: "boolean",
      description: "Show yesterday's entries",
    },
    week: {
      type: "boolean",
      description: "Show this week's entries",
    },
    month: {
      type: "boolean",
      description: "Show this month's entries",
    },
    billable: {
      type: "boolean",
      description: "Filter by billable status",
    },
    running: {
      type: "boolean",
      description: "Show only running entries",
    },
    limit: {
      type: "string",
      alias: "n",
      description: "Max entries to show (default: 50)",
    },
    offset: {
      type: "string",
      description: "Number of entries to skip",
    },
  },
  run() {
    throw new Error("Not implemented");
  },
});
