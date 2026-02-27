import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "../..");

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "clokk-project-test-"));
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

// ─── project create ─────────────────────────────────────────────────

describe("clokk project create", () => {
  it("creates a project", () => {
    const r = runClokk(["project", "create", "Acme Corp", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.ok).toBe(true);
    expect(json.data.name).toBe("Acme Corp");
    expect(json.data.id).toMatch(/^prj_/);
  });

  it("creates a project with options", () => {
    const r = runClokk([
      "project", "create", "Premium Client",
      "--client", "Big Co",
      "--rate", "150",
      "--currency", "EUR",
      "--json",
    ]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.client).toBe("Big Co");
    expect(json.data.rate).toBe(150);
    expect(json.data.currency).toBe("EUR");
  });

  it("fails on duplicate name", () => {
    const r = runClokk(["project", "create", "Acme Corp", "--json"]);
    expect(r.exitCode).not.toBe(0);
    const json = parseJson(r.stderr);
    expect(json.error.code).toBe("PROJECT_ALREADY_EXISTS");
  });
});

// ─── project list ───────────────────────────────────────────────────

describe("clokk project list", () => {
  it("lists projects", () => {
    const r = runClokk(["project", "list", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(2);
  });

  it("lists including archived", () => {
    // Archive one first
    runClokk(["project", "archive", "Premium Client", "--json"]);
    const withArchived = parseJson(
      runClokk(["project", "list", "--archived", "--json"]).stdout,
    );
    const withoutArchived = parseJson(
      runClokk(["project", "list", "--json"]).stdout,
    );
    expect(withArchived.data.length).toBeGreaterThanOrEqual(
      withoutArchived.data.length,
    );
  });
});

// ─── project edit ───────────────────────────────────────────────────

describe("clokk project edit", () => {
  it("edits a project", () => {
    const r = runClokk([
      "project", "edit", "Acme Corp",
      "--client", "Acme Inc",
      "--json",
    ]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.client).toBe("Acme Inc");
  });

  it("fails for nonexistent project", () => {
    const r = runClokk(["project", "edit", "NoSuchProject", "--name", "X", "--json"]);
    expect(r.exitCode).not.toBe(0);
    const json = parseJson(r.stderr);
    expect(json.error.code).toBe("PROJECT_NOT_FOUND");
  });
});

// ─── project archive ────────────────────────────────────────────────

describe("clokk project archive", () => {
  it("archives a project", () => {
    runClokk(["project", "create", "ToArchive", "--json"]);
    const r = runClokk(["project", "archive", "ToArchive", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.archived).toBe(true);
  });
});

// ─── project delete ─────────────────────────────────────────────────

describe("clokk project delete", () => {
  it("deletes a project (auto-confirmed in non-TTY)", () => {
    runClokk(["project", "create", "ToDelete", "--json"]);
    const r = runClokk(["project", "delete", "ToDelete", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.name).toBe("ToDelete");
  });

  it("fails with entries referencing project (no force)", () => {
    runClokk(["project", "create", "Busy", "--json"]);
    // Create an entry referencing the project
    runClokk([
      "log", "Work",
      "--from", "2025-01-20T09:00:00Z",
      "--to", "2025-01-20T10:00:00Z",
      "--project", "Busy",
      "--json",
    ]);
    const r = runClokk(["project", "delete", "Busy", "--json"]);
    expect(r.exitCode).not.toBe(0);
  });

  it("force deletes a project with entries", () => {
    const r = runClokk(["project", "delete", "Busy", "--force", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.name).toBe("Busy");
  });
});
