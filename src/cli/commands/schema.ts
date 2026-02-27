import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "schema",
    description: "Output complete CLI schema as JSON",
  },
  args: {},
  run() {
    throw new Error("Not implemented");
  },
});
