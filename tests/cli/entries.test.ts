import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "../..");

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "clokk-entries-test-"));
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

// ─── log ────────────────────────────────────────────────────────────

describe("clokk log", () => {
  it("logs an entry with --to", () => {
    const r = runClokk([
      "log",
      "Retrospective",
      "--from",
      "2025-01-15T09:00:00Z",
      "--to",
      "2025-01-15T10:00:00Z",
      "--json",
    ]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.ok).toBe(true);
    expect(json.data.description).toBe("Retrospective");
    expect(json.data.end_time).toBe("2025-01-15T10:00:00.000Z");
    expect(json.data.duration_seconds).toBe(3600);
  });

  it("logs an entry with --duration", () => {
    const r = runClokk([
      "log",
      "Code review",
      "--from",
      "2025-01-15T14:00:00Z",
      "--duration",
      "1h30m",
      "--json",
    ]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.duration_seconds).toBe(5400);
  });

  it("logs an entry with tags and billable", () => {
    const r = runClokk([
      "log",
      "Client call",
      "--from",
      "2025-01-15T11:00:00Z",
      "--to",
      "2025-01-15T12:00:00Z",
      "--tags",
      "meeting,client",
      "--billable",
      "--json",
    ]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.tags).toEqual(["meeting", "client"]);
    expect(json.data.billable).toBe(true);
  });

  it("fails with both --to and --duration", () => {
    const r = runClokk([
      "log",
      "Bad entry",
      "--from",
      "2025-01-15T09:00:00Z",
      "--to",
      "2025-01-15T10:00:00Z",
      "--duration",
      "1h",
      "--json",
    ]);
    expect(r.exitCode).not.toBe(0);
    const json = parseJson(r.stderr);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });
});

// ─── edit ────────────────────────────────────────────────────────────

describe("clokk edit", () => {
  it("edits an entry description", () => {
    // First log an entry to edit
    const logResult = parseJson(
      runClokk([
        "log",
        "Original",
        "--from",
        "2025-01-16T09:00:00Z",
        "--to",
        "2025-01-16T10:00:00Z",
        "--json",
      ]).stdout,
    );
    const entryId = logResult.data.id;

    const r = runClokk(["edit", entryId, "--description", "Edited", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.description).toBe("Edited");
  });

  it("edits entry tags", () => {
    const logResult = parseJson(
      runClokk([
        "log",
        "Tag me",
        "--from",
        "2025-01-16T11:00:00Z",
        "--to",
        "2025-01-16T12:00:00Z",
        "--json",
      ]).stdout,
    );
    const entryId = logResult.data.id;

    const r = runClokk(["edit", entryId, "--tags", "updated,tags", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.tags).toEqual(["updated", "tags"]);
  });

  it("fails for nonexistent entry", () => {
    const r = runClokk(["edit", "ent_nonexistent", "--description", "Nope", "--json"]);
    expect(r.exitCode).not.toBe(0);
    const json = parseJson(r.stderr);
    expect(json.error.code).toBe("ENTRY_NOT_FOUND");
  });
});

// ─── delete ──────────────────────────────────────────────────────────

describe("clokk delete", () => {
  it("deletes an entry (auto-confirmed in non-TTY)", () => {
    const logResult = parseJson(
      runClokk([
        "log",
        "Delete me",
        "--from",
        "2025-01-17T09:00:00Z",
        "--to",
        "2025-01-17T10:00:00Z",
        "--json",
      ]).stdout,
    );
    const entryId = logResult.data.id;

    const r = runClokk(["delete", entryId, "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.id).toBe(entryId);
  });

  it("fails for nonexistent entry", () => {
    const r = runClokk(["delete", "ent_nonexistent", "--json"]);
    expect(r.exitCode).not.toBe(0);
    const json = parseJson(r.stderr);
    expect(json.error.code).toBe("ENTRY_NOT_FOUND");
  });
});

// ─── list ────────────────────────────────────────────────────────────

describe("clokk list", () => {
  it("lists entries", () => {
    const r = runClokk(["list", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.data.entries)).toBe(true);
    expect(json.data.total).toBeGreaterThan(0);
  });

  it("lists entries with limit", () => {
    const r = runClokk(["list", "--limit", "2", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.entries.length).toBeLessThanOrEqual(2);
    expect(json.data.limit).toBe(2);
  });

  it("lists entries with project filter", () => {
    // Create project and log an entry for it
    runClokk(["project", "create", "FilterProject", "--json"]);
    runClokk([
      "log",
      "Filtered",
      "--from",
      "2025-01-18T09:00:00Z",
      "--to",
      "2025-01-18T10:00:00Z",
      "--project",
      "FilterProject",
      "--json",
    ]);

    const r = runClokk(["list", "--project", "FilterProject", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.entries.length).toBeGreaterThanOrEqual(1);
    // All returned entries should have a project_id
    for (const entry of json.data.entries) {
      expect(entry.project_id).not.toBeNull();
    }
  });
});
