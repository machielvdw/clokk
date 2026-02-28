import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "../..");

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "clokk-sync-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function runClokk(args: string[]): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  const proc = Bun.spawnSync(["bun", "src/cli/index.ts", ...args], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, CLOKK_DIR: tmpDir },
  });
  return {
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
    exitCode: proc.exitCode,
  };
}

function parseJson(text: string) {
  return JSON.parse(text);
}

// ─── clokk sync ─────────────────────────────────────────────────

describe("clokk sync", () => {
  it("fails with SYNC_NOT_CONFIGURED when turso is not set up", () => {
    const r = runClokk(["sync", "--json"]);
    expect(r.exitCode).not.toBe(0);
    const json = parseJson(r.stderr);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("SYNC_NOT_CONFIGURED");
    expect(json.error.suggestions).toBeArray();
  });
});

// ─── clokk auth login ──────────────────────────────────────────

describe("clokk auth login", () => {
  it("sets turso credentials and returns url", () => {
    const r = runClokk([
      "auth",
      "login",
      "--url",
      "libsql://test.turso.io",
      "--token",
      "tok123",
      "--json",
    ]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.ok).toBe(true);
    expect(json.data.url).toBe("libsql://test.turso.io");
  });

  it("persists credentials to config file", () => {
    runClokk(["auth", "login", "--url", "libsql://test.turso.io", "--token", "tok123", "--json"]);

    // Read config file directly (not via `clokk config get` which would
    // trigger TursoRepository creation with the non-existent URL)
    const configPath = join(tmpDir, "config.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config.turso.url).toBe("libsql://test.turso.io");
    expect(config.turso.token).toBe("tok123");
  });
});

// ─── clokk auth logout ─────────────────────────────────────────

describe("clokk auth logout", () => {
  it("returns was_configured=false when not configured", () => {
    const r = runClokk(["auth", "logout", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.ok).toBe(true);
    expect(json.data.was_configured).toBe(false);
  });

  it("other commands still work after logout", () => {
    // Logout when not configured, then verify normal commands work
    runClokk(["auth", "logout", "--json"]);
    const r = runClokk(["status", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.ok).toBe(true);
  });
});
