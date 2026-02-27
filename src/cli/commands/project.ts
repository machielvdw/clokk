import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "project",
    description: "Manage projects",
  },
  args: {},
  subCommands: {
    create: defineCommand({
      meta: { name: "create", description: "Create a new project" },
      args: {
        name: {
          type: "positional",
          description: "Project name",
          required: true,
        },
        client: {
          type: "string",
          alias: "c",
          description: "Client name",
        },
        rate: {
          type: "string",
          description: "Hourly rate",
        },
        currency: {
          type: "string",
          description: "Currency code (default: USD)",
        },
        color: {
          type: "string",
          description: "Hex color code",
        },
      },
      run() {
        throw new Error("Not implemented");
      },
    }),
    list: defineCommand({
      meta: { name: "list", description: "List all projects" },
      args: {
        archived: {
          type: "boolean",
          description: "Include archived projects",
        },
      },
      run() {
        throw new Error("Not implemented");
      },
    }),
    edit: defineCommand({
      meta: { name: "edit", description: "Edit a project" },
      args: {
        nameOrId: {
          type: "positional",
          description: "Project name or ID",
          required: true,
        },
        name: {
          type: "string",
          description: "New project name",
        },
        client: {
          type: "string",
          description: "New client name",
        },
        rate: {
          type: "string",
          description: "New hourly rate",
        },
        currency: {
          type: "string",
          description: "New currency code",
        },
        color: {
          type: "string",
          description: "New hex color code",
        },
      },
      run() {
        throw new Error("Not implemented");
      },
    }),
    archive: defineCommand({
      meta: { name: "archive", description: "Archive a project" },
      args: {
        nameOrId: {
          type: "positional",
          description: "Project name or ID",
          required: true,
        },
      },
      run() {
        throw new Error("Not implemented");
      },
    }),
    delete: defineCommand({
      meta: { name: "delete", description: "Delete a project" },
      args: {
        nameOrId: {
          type: "positional",
          description: "Project name or ID",
          required: true,
        },
        force: {
          type: "boolean",
          description: "Force delete even if entries reference this project",
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
    }),
  },
});
