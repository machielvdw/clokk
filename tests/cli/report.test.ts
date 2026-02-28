import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "../..");

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "clokk-report-test-"));
  // Seed some entries
  const run = (args: string[]) =>
    Bun.spawnSync(["bun", "src/cli/index.ts", ...args], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, CLOKK_DIR: tmpDir },
    });
  run([
    "log",
    "Morning work",
    "--from",
    new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
    "--to",
    new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    "--tags",
    "dev",
    "--billable",
    "--json",
  ]);
  run([
    "log",
    "Afternoon work",
    "--from",
    new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    "--to",
    new Date(Date.now() - 3600 * 1000).toISOString(),
    "--tags",
    "review",
    "--json",
  ]);
});

afterAll(() => {
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

function parseJson(stdout: string) {
  return JSON.parse(stdout);
}

// ─── report ─────────────────────────────────────────────────────────

describe("clokk report", () => {
  it("generates a report (default: this week)", () => {
    const r = runClokk(["report", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.ok).toBe(true);
    expect(json.data.total_seconds).toBeGreaterThan(0);
    expect(json.data.groups).toBeDefined();
  });

  it("generates a report for today", () => {
    const r = runClokk(["report", "--today", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.total_seconds).toBeGreaterThan(0);
  });

  it("generates a report grouped by tag", () => {
    const r = runClokk(["report", "--today", "--group-by", "tag", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    const keys = json.data.groups.map((g: { key: string }) => g.key);
    expect(keys).toContain("dev");
  });

  it("generates a report grouped by day", () => {
    const r = runClokk(["report", "--week", "--group-by", "day", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.groups.length).toBeGreaterThan(0);
    // Day group keys should be date strings
    expect(json.data.groups[0].key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── export ─────────────────────────────────────────────────────────

describe("clokk export", () => {
  it("exports as CSV to stdout", () => {
    const r = runClokk(["export", "--today", "--format", "csv"]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("id,description,project");
    expect(r.stdout).toContain("Morning work");
  });

  it("exports as JSON to stdout", () => {
    const r = runClokk(["export", "--today", "--format", "json"]);
    expect(r.exitCode).toBe(0);
    const json = JSON.parse(r.stdout);
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
    expect(json[0].description).toBeDefined();
  });

  it("exports to a file", () => {
    const outPath = join(tmpDir, "export.csv");
    const r = runClokk(["export", "--today", "--format", "csv", "--output", outPath, "--json"]);
    expect(r.exitCode).toBe(0);
    expect(existsSync(outPath)).toBe(true);
    const content = readFileSync(outPath, "utf-8");
    expect(content).toContain("id,description,project");
  });
});
