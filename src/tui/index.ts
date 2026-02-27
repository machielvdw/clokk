import { plugin } from "bun";
import solidPlugin from "@opentui/solid/bun-plugin";

// Register the SolidJS transform plugin before loading any .tsx files.
// This uses babel-preset-solid to compile JSX into fine-grained reactive calls
// instead of Bun's built-in React-style JSX transform.
plugin(solidPlugin);

export async function launchTui(): Promise<void> {
  const { startApp } = await import("@/tui/render.tsx");
  await startApp();
}
