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
      description: "Tags (comma-separated)",
    },
    billable: {
      type: "boolean",
      description: "Mark as billable",
    },
    at: {
      type: "string",
      description: "Override start time",
    },
  },
  run() {
    throw new Error("Not implemented");
  },
});
