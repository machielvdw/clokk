/**
 * Binary Compilation Tests — spec §14
 *
 * Verifies that `bun build --compile` produces a working
 * standalone binary that passes basic smoke tests.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "../..");
const BINARY_PATH = join(PROJECT_ROOT, "dist", "clokk-test");

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "clokk-binary-"));

  // Build the binary
  const build = Bun.spawnSync(
    ["bun", "build", "./src/cli/index.ts", "--compile", "--outfile", BINARY_PATH],
    { cwd: PROJECT_ROOT },
  );
  if (build.exitCode !== 0) {
    console.error("Build failed:", build.stderr.toString());
  }
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  // Clean up binary
  if (existsSync(BINARY_PATH)) {
    rmSync(BINARY_PATH);
  }
});

function runBinary(args: string[]): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  const proc = Bun.spawnSync([BINARY_PATH, ...args], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, CLOKK_DIR: tmpDir },
  });
  return {
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
    exitCode: proc.exitCode,
  };
}

// ─── Build ──────────────────────────────────────────────────────────

describe("Binary compilation", () => {
  it("produces an executable binary", () => {
    expect(existsSync(BINARY_PATH)).toBe(true);
  });

  it("--version outputs version number", () => {
    const r = runBinary(["--version"]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe("0.1.0");
  });

  it("--help shows available commands", () => {
    const r = runBinary(["--help"]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("start");
    expect(r.stdout).toContain("stop");
    expect(r.stdout).toContain("status");
  });

  it("runs a full timer lifecycle", () => {
    // Start
    const start = runBinary(["start", "Binary test", "--json"]);
    expect(start.exitCode).toBe(0);
    const startJson = JSON.parse(start.stdout);
    expect(startJson.ok).toBe(true);
    expect(startJson.data.description).toBe("Binary test");

    // Status
    const status = runBinary(["status", "--json"]);
    expect(status.exitCode).toBe(0);
    const statusJson = JSON.parse(status.stdout);
    expect(statusJson.data.running).toBe(true);

    // Stop
    const stop = runBinary(["stop", "--json"]);
    expect(stop.exitCode).toBe(0);
    const stopJson = JSON.parse(stop.stdout);
    expect(stopJson.data.end_time).not.toBeNull();
    expect(stopJson.data.duration_seconds).toBeGreaterThanOrEqual(0);
  });

  it("commands output works", () => {
    const r = runBinary(["commands", "--json"]);
    expect(r.exitCode).toBe(0);
    const data = JSON.parse(r.stdout);
    expect(data.ok).toBe(true);
    expect(data.data.length).toBe(19);
  });
});
