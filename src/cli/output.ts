import { colorize } from "consola/utils";
import type { ClokkError } from "@/core/errors.ts";

// ─── Types ───────────────────────────────────────────────────────────

export type OutputMode = "json" | "human";

export interface OutputOptions {
  mode?: OutputMode;
  stdout?: { write(s: string): unknown };
  stderr?: { write(s: string): unknown };
  exit?: (code: number) => void;
}

// ─── Output mode detection ───────────────────────────────────────────

/**
 * Determine whether output should be JSON or human-readable.
 * Priority: --json flag > --human flag > CLOKK_OUTPUT env > TTY detection.
 */
export function detectOutputMode(opts?: {
  json?: boolean;
  human?: boolean;
  isTTY?: boolean;
}): OutputMode {
  if (opts?.json) return "json";
  if (opts?.human) return "human";

  const envOutput = process.env.CLOKK_OUTPUT;
  if (envOutput === "json") return "json";
  if (envOutput === "human") return "human";

  const isTTY = opts?.isTTY ?? process.stdout.isTTY;
  if (isTTY) return "human";

  return "json";
}

// ─── JSON envelope formatting ────────────────────────────────────────

/**
 * Format a success response as a JSON envelope string.
 */
export function formatSuccessJson(data: unknown, message: string): string {
  return JSON.stringify({ ok: true, data, message }, null, 2);
}

/**
 * Format a ClokkError as a JSON error envelope string.
 */
export function formatErrorJson(err: ClokkError): string {
  return JSON.stringify(
    {
      ok: false,
      error: {
        code: err.code,
        message: err.message,
        suggestions: err.suggestions,
        context: err.context,
      },
    },
    null,
    2,
  );
}

// ─── Human error formatting ──────────────────────────────────────────

function formatErrorHuman(err: ClokkError): string {
  const lines: string[] = [];
  lines.push(colorize("red", "Error:") + " " + err.message);

  if (err.suggestions.length > 0) {
    lines.push("  " + colorize("dim", "Try:") + " " + colorize("cyan", err.suggestions[0]!));
    for (let i = 1; i < err.suggestions.length; i++) {
      lines.push("       " + colorize("cyan", err.suggestions[i]!));
    }
  }

  return lines.join("\n");
}

// ─── Side-effecting output functions ─────────────────────────────────

/**
 * Output a success response. Writes JSON envelope or human-formatted output.
 * Does NOT call process.exit — success exit is implicit.
 */
export function success(
  data: unknown,
  message: string,
  humanFormatter?: (data: unknown) => string,
  opts?: OutputOptions,
): void {
  const mode = opts?.mode ?? detectOutputMode();
  const out = opts?.stdout ?? process.stdout;

  if (mode === "json") {
    out.write(formatSuccessJson(data, message) + "\n");
  } else {
    out.write((humanFormatter ? humanFormatter(data) : message) + "\n");
  }
}

/**
 * Output an error response and exit with the error's exit code.
 * Writes JSON envelope or human-formatted error to stderr.
 */
export function error(
  err: ClokkError,
  humanFormatter?: (err: ClokkError) => string,
  opts?: OutputOptions,
): never {
  const mode = opts?.mode ?? detectOutputMode();
  const errOut = opts?.stderr ?? process.stderr;
  const exitFn = opts?.exit ?? process.exit;

  if (mode === "json") {
    errOut.write(formatErrorJson(err) + "\n");
  } else {
    errOut.write((humanFormatter ? humanFormatter(err) : formatErrorHuman(err)) + "\n");
  }

  exitFn(err.exitCode);

  // TypeScript needs this for the `never` return type when exit is injected
  throw new Error("process.exit should have terminated");
}
