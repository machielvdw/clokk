import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "start",
    description: "Start a new timer",
  },
  args: {
    description: {
      type: "positional",
      description: "What you're working on",
      required: false,
    },
    project: {
      type: "string",
      alias: "p",
      description: "Project name or ID",
    },
    tags: {
      type: "string",
      alias: "t",
      description: "Tags for categorization (comma-separated)",
    },
    billable: {
      type: "boolean",
      description: "Mark as billable",
      default: true,
    },
    at: {
      type: "string",
      description: "Override start time (e.g. '30 minutes ago')",
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
    },
  },
  run({ args }) {
    console.log("TODO: start timer", args);
  },
});
