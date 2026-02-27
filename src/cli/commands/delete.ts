import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "delete",
    description: "Delete a time entry",
  },
  args: {
    entryId: {
      type: "positional",
      description: "Entry ID to delete",
      required: true,
    },
    yes: {
      type: "boolean",
      alias: "y",
      description: "Skip confirmation prompt",
    },
  },
  run() {
    throw new Error("Not implemented");
  },
});
