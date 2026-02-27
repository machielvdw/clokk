/**
 * First-Run Experience Tests — spec §8
 *
 * Validates that clokk auto-initializes on first use:
 * creates config dir, writes default config.json, and
 * initializes the SQLite database with migrations.
 */
import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "../..");

function runClokk(
  args: string[],
  env: Record<string, string>,
): { stdout: string; stderr: string; exitCode: number } {
  const proc = Bun.spawnSync(["bun", "src/cli/index.ts", ...args], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, ...env },
  });
  return {
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
    exitCode: proc.exitCode,
  };
}

function freshDir(): string {
  return mkdtempSync(join(tmpdir(), "clokk-firstrun-"));
}

// ─── Directory and config creation ──────────────────────────────────

describe("First-run experience", () => {
  it("creates config.json with defaults on first command", () => {
    const dir = freshDir();
    try {
      const r = runClokk(["config", "show", "--json"], { CLOKK_DIR: dir });
      expect(r.exitCode).toBe(0);

      const configPath = join(dir, "config.json");
      expect(existsSync(configPath)).toBe(true);

      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.week_start).toBe("monday");
      expect(config.default_currency).toBe("USD");
      expect(config.default_billable).toBe(true);
      expect(config.default_project).toBeNull();
      expect(config.date_format).toBe("iso");
      expect(config.turso).toBeDefined();
      expect(config.turso.url).toBeNull();
      expect(config.turso.token).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("creates database on first command", () => {
    const dir = freshDir();
    try {
      runClokk(["status", "--json"], { CLOKK_DIR: dir });
      expect(existsSync(join(dir, "clokk.db"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("works immediately without setup — status returns not running", () => {
    const dir = freshDir();
    try {
      const r = runClokk(["status", "--json"], { CLOKK_DIR: dir });
      expect(r.exitCode).toBe(0);
      const data = JSON.parse(r.stdout);
      expect(data.ok).toBe(true);
      expect(data.data.running).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("respects CLOKK_DIR environment variable", () => {
    const dir = freshDir();
    try {
      runClokk(["status", "--json"], { CLOKK_DIR: dir });
      // Files should be in the custom dir, not ~/.clokk
      expect(existsSync(join(dir, "config.json"))).toBe(true);
      expect(existsSync(join(dir, "clokk.db"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reuses existing config and database on subsequent runs", () => {
    const dir = freshDir();
    try {
      // First run: create everything and start a timer
      runClokk(["start", "Persistent", "--json"], { CLOKK_DIR: dir });

      // Second run: timer should still be running
      const r = runClokk(["status", "--json"], { CLOKK_DIR: dir });
      expect(r.exitCode).toBe(0);
      const data = JSON.parse(r.stdout);
      expect(data.data.running).toBe(true);
      expect(data.data.entry.description).toBe("Persistent");

      // Clean up timer
      runClokk(["stop", "--json"], { CLOKK_DIR: dir });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("first command can be any command — start works", () => {
    const dir = freshDir();
    try {
      const r = runClokk(["start", "First ever timer", "--json"], { CLOKK_DIR: dir });
      expect(r.exitCode).toBe(0);
      const data = JSON.parse(r.stdout);
      expect(data.ok).toBe(true);
      expect(data.data.description).toBe("First ever timer");

      runClokk(["stop", "--json"], { CLOKK_DIR: dir });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
