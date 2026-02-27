import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "config",
    description: "Manage configuration",
  },
  args: {},
  subCommands: {
    show: defineCommand({
      meta: { name: "show", description: "Show all configuration values" },
      args: {},
      run() {
        throw new Error("Not implemented");
      },
    }),
    get: defineCommand({
      meta: { name: "get", description: "Get a configuration value" },
      args: {
        key: {
          type: "positional",
          description: "Configuration key",
          required: true,
        },
      },
      run() {
        throw new Error("Not implemented");
      },
    }),
    set: defineCommand({
      meta: { name: "set", description: "Set a configuration value" },
      args: {
        key: {
          type: "positional",
          description: "Configuration key",
          required: true,
        },
        value: {
          type: "positional",
          description: "New value",
          required: true,
        },
      },
      run() {
        throw new Error("Not implemented");
      },
    }),
  },
});
