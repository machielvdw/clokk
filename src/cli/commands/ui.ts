import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "ui",
    description: "Launch the interactive terminal UI",
  },
  args: {},
  async run() {
    // Dynamic path prevents bun build --compile from statically analyzing
    // the TUI module tree (which requires the SolidJS Bun plugin at runtime).
    const modulePath = "@/tui/index.ts";
    const { launchTui } = await import(modulePath);
    await launchTui();
  },
});
