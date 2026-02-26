import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "list",
    description: "List all projects",
  },
  args: {
    archived: {
      type: "boolean",
      description: "Include archived projects",
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
    },
  },
  run({ args }) {
    console.log("TODO: list projects", args);
  },
});
