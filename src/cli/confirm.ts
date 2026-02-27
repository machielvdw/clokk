import { createInterface } from "node:readline/promises";

/**
 * Prompt for confirmation in TTY mode. Returns true if user confirms.
 * Auto-confirms when stdout is not a TTY (piped to agent) or --yes is set.
 */
export async function confirmAction(
  message: string,
  opts?: { yes?: boolean },
): Promise<boolean> {
  if (opts?.yes || !process.stdout.isTTY) return true;

  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  try {
    const answer = await rl.question(`${message} [y/N] `);
    return answer.trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}
