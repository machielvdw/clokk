import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "log",
    description: "Log a completed time entry",
  },
  args: {
    description: {
      type: "positional",
      description: "What you worked on",
      required: false,
    },
    project: {
      type: "string",
      alias: "p",
      description: "Project name or ID",
    },
    from: {
      type: "string",
      description: "Start time (required)",
      required: true,
    },
    to: {
      type: "string",
      description: "End time (mutually exclusive with --duration)",
    },
    duration: {
      type: "string",
      description: "Duration (mutually exclusive with --to)",
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
  },
  run() {
    throw new Error("Not implemented");
  },
});
