import { defineCommand } from "citty";
import { success } from "@/cli/output.ts";

const COMMANDS = [
  { name: "start", description: "Start a new timer" },
  { name: "stop", description: "Stop the current timer" },
  { name: "status", description: "Show current timer status" },
  { name: "resume", description: "Resume the last stopped timer" },
  { name: "switch", description: "Stop current timer and start a new one" },
  { name: "cancel", description: "Discard the running timer" },
  { name: "log", description: "Log a completed time entry" },
  { name: "edit", description: "Edit an existing time entry" },
  { name: "delete", description: "Delete a time entry" },
  { name: "list", description: "List time entries" },
  { name: "project", description: "Manage projects (create, list, edit, archive, delete)" },
  { name: "report", description: "Generate a time report" },
  { name: "export", description: "Export time entries" },
  { name: "config", description: "Manage configuration (show, get, set)" },
  { name: "schema", description: "Output complete CLI schema as JSON" },
  { name: "commands", description: "List all available commands" },
];

export default defineCommand({
  meta: {
    name: "commands",
    description: "List all available commands",
  },
  args: {},
  async run() {
    success(COMMANDS, `${COMMANDS.length} commands available.`, () => {
      const maxLen = Math.max(...COMMANDS.map((c) => c.name.length));
      return COMMANDS.map(
        (c) => `  ${c.name.padEnd(maxLen)}  ${c.description}`,
      ).join("\n");
    });
  },
});
