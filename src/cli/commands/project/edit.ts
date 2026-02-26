import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "edit",
    description: "Edit an existing project",
  },
  args: {
    nameOrId: {
      type: "positional",
      description: "Project name or ID",
      required: true,
    },
    name: {
      type: "string",
      description: "Rename project",
    },
    client: {
      type: "string",
      description: "Update client",
    },
    rate: {
      type: "string",
      description: "Update hourly rate",
    },
    currency: {
      type: "string",
      description: "Update currency",
    },
    color: {
      type: "string",
      description: "Update color",
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
    },
  },
  run({ args }) {
    console.log("TODO: edit project", args);
  },
});
