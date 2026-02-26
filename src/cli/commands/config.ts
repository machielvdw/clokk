import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "config",
    description: "Manage configuration",
  },
  subCommands: {
    show: defineCommand({
      meta: {
        name: "show",
        description: "Display all current configuration",
      },
      args: {
        json: {
          type: "boolean",
          description: "Output as JSON",
        },
      },
      run({ args }) {
        console.log("TODO: show config", args);
      },
    }),
    set: defineCommand({
      meta: {
        name: "set",
        description: "Set a configuration value",
      },
      args: {
        key: {
          type: "positional",
          description: "Config key",
          required: true,
        },
        value: {
          type: "positional",
          description: "Config value",
          required: true,
        },
        json: {
          type: "boolean",
          description: "Output as JSON",
        },
      },
      run({ args }) {
        console.log("TODO: set config", args);
      },
    }),
    get: defineCommand({
      meta: {
        name: "get",
        description: "Get a single configuration value",
      },
      args: {
        key: {
          type: "positional",
          description: "Config key",
          required: true,
        },
        json: {
          type: "boolean",
          description: "Output as JSON",
        },
      },
      run({ args }) {
        console.log("TODO: get config", args);
      },
    }),
  },
});
