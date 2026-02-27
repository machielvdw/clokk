import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "ui",
    description: "Launch the interactive terminal UI",
  },
  args: {},
  async run() {
    const { launchTui } = await import("@/tui/index.ts");
    await launchTui();
  },
});
