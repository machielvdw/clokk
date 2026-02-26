import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "switch",
    description: "Stop current timer and start a new one",
  },
  args: {
    description: {
      type: "positional",
      description: "Description for the new timer",
      required: true,
    },
    project: {
      type: "string",
      alias: "p",
      description: "Project for the new timer",
    },
    tags: {
      type: "string",
      alias: "t",
      description: "Tags for the new timer",
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
    },
  },
  run({ args }) {
    console.log("TODO: switch timer", args);
  },
});
