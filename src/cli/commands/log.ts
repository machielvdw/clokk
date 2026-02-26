import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "log",
    description: "Add a completed time entry manually",
  },
  args: {
    description: {
      type: "positional",
      description: "What was worked on",
      required: false,
    },
    project: {
      type: "string",
      alias: "p",
      description: "Project name or ID",
    },
    from: {
      type: "string",
      description: "Start time",
      required: true,
    },
    to: {
      type: "string",
      description: "End time",
    },
    duration: {
      type: "string",
      description: "Duration (e.g. '1h30m') — alternative to --to",
    },
    tags: {
      type: "string",
      alias: "t",
      description: "Tags",
    },
    billable: {
      type: "boolean",
      description: "Mark as billable",
      default: true,
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
    },
  },
  run({ args }) {
    console.log("TODO: log entry", args);
  },
});
