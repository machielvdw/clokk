import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "edit",
    description: "Modify an existing time entry",
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
      description: "New project",
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
      description: "Replace tags",
    },
    billable: {
      type: "boolean",
      description: "Update billable status",
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
    },
  },
  run({ args }) {
    console.log("TODO: edit entry", args);
  },
});
