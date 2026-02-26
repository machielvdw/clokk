import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "archive",
    description: "Archive a project (soft-delete)",
  },
  args: {
    nameOrId: {
      type: "positional",
      description: "Project name or ID",
      required: true,
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
    },
  },
  run({ args }) {
    console.log("TODO: archive project", args);
  },
});
