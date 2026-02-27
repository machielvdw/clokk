import { defineCommand } from "citty";
import { getContext } from "@/cli/context.ts";
import { login, logout } from "@/core/auth.ts";
import { saveConfig } from "@/config.ts";
import { success } from "@/cli/output.ts";

export default defineCommand({
  meta: {
    name: "auth",
    description: "Manage Turso sync authentication",
  },
  args: {},
  subCommands: {
    login: defineCommand({
      meta: { name: "login", description: "Configure Turso sync credentials" },
      args: {
        url: {
          type: "string",
          description: "Turso database URL (libsql://...)",
          required: true,
        },
        token: {
          type: "string",
          description: "Turso auth token",
          required: true,
        },
      },
      async run({ args }) {
        const { config } = await getContext();
        const result = login(config, { url: args.url, token: args.token });
        saveConfig(result.config);
        success(
          { url: result.url },
          "Turso sync configured. Run 'clokk sync' to trigger initial sync.",
        );
      },
    }),
    logout: defineCommand({
      meta: {
        name: "logout",
        description: "Remove Turso credentials and revert to local-only",
      },
      args: {},
      async run() {
        const { config } = await getContext();
        const result = logout(config);
        saveConfig(result.config);
        success(
          { was_configured: result.was_configured },
          result.was_configured
            ? "Turso credentials removed. Reverted to local-only mode."
            : "No Turso credentials were configured.",
        );
      },
    }),
  },
});
