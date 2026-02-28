import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "../..");

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "clokk-config-test-"));
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

// ─── config show ────────────────────────────────────────────────────

describe("clokk config show", () => {
  it("shows all config values", () => {
    const r = runClokk(["config", "show", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.ok).toBe(true);
    expect(json.data.week_start).toBe("monday");
    expect(json.data.default_currency).toBe("USD");
  });
});

// ─── config get ─────────────────────────────────────────────────────

describe("clokk config get", () => {
  it("gets a config value", () => {
    const r = runClokk(["config", "get", "week_start", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.key).toBe("week_start");
    expect(json.data.value).toBe("monday");
  });

  it("fails for unknown key", () => {
    const r = runClokk(["config", "get", "nonexistent_key", "--json"]);
    expect(r.exitCode).not.toBe(0);
    const json = parseJson(r.stderr);
    expect(json.error.code).toBe("CONFIG_KEY_UNKNOWN");
  });
});

// ─── config set ─────────────────────────────────────────────────────

describe("clokk config set", () => {
  it("sets a string value", () => {
    const r = runClokk(["config", "set", "week_start", "sunday", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.value).toBe("sunday");

    // Verify it persisted
    const get = parseJson(runClokk(["config", "get", "week_start", "--json"]).stdout);
    expect(get.data.value).toBe("sunday");
  });

  it("sets a boolean value", () => {
    const r = runClokk(["config", "set", "default_billable", "false", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.value).toBe(false);

    // Verify it persisted
    const get = parseJson(runClokk(["config", "get", "default_billable", "--json"]).stdout);
    expect(get.data.value).toBe(false);
  });

  it("sets a null value", () => {
    const r = runClokk(["config", "set", "default_project", "null", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.value).toBeNull();
  });
});

// ─── schema ─────────────────────────────────────────────────────────

describe("clokk schema", () => {
  it("outputs CLI schema as JSON", () => {
    const r = runClokk(["schema"]);
    expect(r.exitCode).toBe(0);
    const json = JSON.parse(r.stdout);
    expect(json.name).toBe("clokk");
    expect(json.subCommands).toBeDefined();
    expect(json.subCommands.length).toBeGreaterThan(0);
    const names = json.subCommands.map((c: { name: string }) => c.name);
    expect(names).toContain("start");
    expect(names).toContain("stop");
    expect(names).toContain("project");
  });
});

// ─── commands ───────────────────────────────────────────────────────

describe("clokk commands", () => {
  it("lists all commands as JSON", () => {
    const r = runClokk(["commands", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBe(20);
    const names = json.data.map((c: { name: string }) => c.name);
    expect(names).toContain("start");
    expect(names).toContain("project");
    expect(names).toContain("schema");
  });
});
