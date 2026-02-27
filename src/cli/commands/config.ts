import { defineCommand } from "citty";
import { getContext } from "@/cli/context.ts";
import { showConfig, getConfigValue, setConfigValue } from "@/core/config.ts";
import { saveConfig } from "@/config.ts";
import { success } from "@/cli/output.ts";
import type { ClokkConfig } from "@/config.ts";

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
      async run() {
        const { config } = await getContext();
        const result = showConfig(config);
        success(result, "Configuration:", (d) =>
          JSON.stringify(d as ClokkConfig, null, 2),
        );
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
      async run({ args }) {
        const { config } = await getContext();
        const result = getConfigValue(config, args.key);
        success(result, `${result.key} = ${JSON.stringify(result.value)}`, (d) => {
          const r = d as { key: string; value: unknown };
          return `${r.key} = ${JSON.stringify(r.value)}`;
        });
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
      async run({ args }) {
        const { config } = await getContext();
        // Parse CLI string values into appropriate types
        const parsed = parseConfigValue(args.value);
        const result = setConfigValue(config, args.key, parsed);
        saveConfig(result.config);
        success(
          { key: result.key, value: result.value },
          `Set ${result.key} = ${JSON.stringify(result.value)}.`,
        );
      },
    }),
  },
});

function parseConfigValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  return raw;
}
