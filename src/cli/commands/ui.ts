import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "ui",
    description: "Launch the interactive terminal UI",
  },
  args: {},
  async run() {
    // Detect compiled binary: Bun embeds binaries under /$bunfs/
    const isCompiled =
      process.argv[0]?.includes("/$bunfs/") || import.meta.path?.includes("/$bunfs/");

    if (isCompiled) {
      // Compiled binary: use pre-compiled TUI (Babel-transformed, no Bun plugin needed).
      // This static string lets the bundler trace and include the .build/tui/ files.
      // @ts-expect-error — generated file, no .d.ts
      const { launchTui } = await import("../../../.build/tui/index.js");
      await launchTui();
    } else {
      // Development: use runtime SolidJS Bun plugin for JSX transforms.
      // Opaque path prevents the bundler from tracing into the TUI module tree.
      const modulePath = "@/tui/index.ts";
      const { launchTui } = await import(modulePath);
      await launchTui();
    }
  },
});
