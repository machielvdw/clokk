import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "list",
    description: "List time entries with filtering",
  },
  args: {
    project: {
      type: "string",
      alias: "p",
      description: "Filter by project",
    },
    tags: {
      type: "string",
      alias: "t",
      description: "Filter by tags (AND logic)",
    },
    from: {
      type: "string",
      description: "Entries starting after this time",
    },
    to: {
      type: "string",
      description: "Entries starting before this time",
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
      description: "Max entries to return (default: 50)",
    },
    offset: {
      type: "string",
      description: "Pagination offset",
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
    },
  },
  run({ args }) {
    console.log("TODO: list entries", args);
  },
});
