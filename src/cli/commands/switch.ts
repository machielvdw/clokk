import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "switch",
    description: "Stop current timer and start a new one",
  },
  args: {
    description: {
      type: "positional",
      description: "What you're switching to",
      required: true,
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
  },
  run() {
    throw new Error("Not implemented");
  },
});
