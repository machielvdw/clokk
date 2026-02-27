import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "commands",
    description: "List all available commands",
  },
  args: {},
  run() {
    throw new Error("Not implemented");
  },
});
