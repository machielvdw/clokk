import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "resume",
    description: "Resume the most recently stopped timer",
  },
  args: {
    id: {
      type: "string",
      description: "Resume a specific entry instead of the most recent",
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
    },
  },
  run({ args }) {
    console.log("TODO: resume timer", args);
  },
});
