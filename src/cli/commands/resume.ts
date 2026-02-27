import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "resume",
    description: "Resume the last stopped timer",
  },
  args: {
    id: {
      type: "string",
      description: "Resume a specific entry by ID",
    },
  },
  run() {
    throw new Error("Not implemented");
  },
});
