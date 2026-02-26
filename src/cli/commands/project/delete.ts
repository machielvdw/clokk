import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "delete",
    description: "Permanently delete a project",
  },
  args: {
    nameOrId: {
      type: "positional",
      description: "Project name or ID",
      required: true,
    },
    force: {
      type: "boolean",
      description: "Delete even if entries exist",
    },
    yes: {
      type: "boolean",
      alias: "y",
      description: "Skip confirmation",
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
    },
  },
  run({ args }) {
    console.log("TODO: delete project", args);
  },
});
