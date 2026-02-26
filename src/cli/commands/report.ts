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
      description: "Filter by project",
    },
    tags: {
      type: "string",
      alias: "t",
      description: "Filter by tags",
    },
    from: {
      type: "string",
      description: "Report period start",
    },
    to: {
      type: "string",
      description: "Report period end",
    },
    today: {
      type: "boolean",
      description: "Today's report",
    },
    yesterday: {
      type: "boolean",
      description: "Yesterday's report",
    },
    week: {
      type: "boolean",
      description: "This week's report (default)",
    },
    month: {
      type: "boolean",
      description: "This month's report",
    },
    "group-by": {
      type: "string",
      description: "Group by: project, tag, day, week (default: project)",
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
    },
  },
  run({ args }) {
    console.log("TODO: generate report", args);
  },
});
