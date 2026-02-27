import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "../..");

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "clokk-test-"));
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

// ─── --version ───────────────────────────────────────────────────────

describe("clokk --version", () => {
  it("prints the version number", () => {
    const result = runClokk(["--version"]);
    expect(result.stdout.trim()).toBe("0.1.0");
    expect(result.exitCode).toBe(0);
  });
});

// ─── --help ──────────────────────────────────────────────────────────

describe("clokk --help", () => {
  it("shows help text with available commands", () => {
    const result = runClokk(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("clokk");
    expect(result.stdout).toContain("start");
    expect(result.stdout).toContain("stop");
    expect(result.stdout).toContain("status");
    expect(result.stdout).toContain("resume");
    expect(result.stdout).toContain("switch");
    expect(result.stdout).toContain("cancel");
    expect(result.stdout).toContain("log");
    expect(result.stdout).toContain("list");
    expect(result.stdout).toContain("project");
    expect(result.stdout).toContain("report");
    expect(result.stdout).toContain("export");
    expect(result.stdout).toContain("config");
    expect(result.stdout).toContain("schema");
    expect(result.stdout).toContain("commands");
  });

  it("shows global flags", () => {
    const result = runClokk(["--help"]);
    expect(result.stdout).toContain("--json");
    expect(result.stdout).toContain("--human");
    expect(result.stdout).toContain("--yes");
  });
});

// ─── subcommand help ─────────────────────────────────────────────────

describe("subcommand --help", () => {
  it("shows help for start command", () => {
    const result = runClokk(["start", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Start a new timer");
    expect(result.stdout).toContain("--project");
    expect(result.stdout).toContain("--tags");
    expect(result.stdout).toContain("--billable");
    expect(result.stdout).toContain("DESCRIPTION");
  });

  it("shows help for project subcommands", () => {
    const result = runClokk(["project", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Manage projects");
    expect(result.stdout).toContain("create");
    expect(result.stdout).toContain("list");
    expect(result.stdout).toContain("edit");
    expect(result.stdout).toContain("archive");
    expect(result.stdout).toContain("delete");
  });

  it("shows help for nested project create", () => {
    const result = runClokk(["project", "create", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Create a new project");
    expect(result.stdout).toContain("NAME");
    expect(result.stdout).toContain("--client");
    expect(result.stdout).toContain("--rate");
  });

  it("shows help for config subcommands", () => {
    const result = runClokk(["config", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Manage configuration");
    expect(result.stdout).toContain("show");
    expect(result.stdout).toContain("get");
    expect(result.stdout).toContain("set");
  });
});

// ─── unknown command ─────────────────────────────────────────────────

describe("unknown command", () => {
  it("exits with non-zero code", () => {
    const result = runClokk(["nonexistent"]);
    expect(result.exitCode).not.toBe(0);
  });

  it("shows an error message", () => {
    const result = runClokk(["nonexistent"]);
    const output = result.stdout + result.stderr;
    expect(output).toContain("nonexistent");
  });
});
