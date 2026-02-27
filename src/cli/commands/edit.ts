import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "edit",
    description: "Edit an existing time entry",
  },
  args: {
    entryId: {
      type: "positional",
      description: "Entry ID to edit",
      required: true,
    },
    description: {
      type: "string",
      alias: "d",
      description: "New description",
    },
    project: {
      type: "string",
      alias: "p",
      description: "New project name or ID",
    },
    from: {
      type: "string",
      description: "New start time",
    },
    to: {
      type: "string",
      description: "New end time",
    },
    tags: {
      type: "string",
      alias: "t",
      description: "New tags (comma-separated)",
    },
    billable: {
      type: "boolean",
      description: "Set billable status",
    },
  },
  run() {
    throw new Error("Not implemented");
  },
});
