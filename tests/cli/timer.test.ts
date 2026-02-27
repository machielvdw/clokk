import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "../..");

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "clokk-timer-test-"));
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

// ─── start ──────────────────────────────────────────────────────────

describe("clokk start", () => {
  it("starts a timer with description", () => {
    const r = runClokk(["start", "Working on feature", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.ok).toBe(true);
    expect(json.data.description).toBe("Working on feature");
    expect(json.data.end_time).toBeNull();
    expect(json.data.id).toMatch(/^ent_/);

    // Clean up: stop the timer
    runClokk(["stop", "--json"]);
  });

  it("starts a timer with tags", () => {
    const r = runClokk(["start", "Tagged work", "--tags", "bug,urgent", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.tags).toEqual(["bug", "urgent"]);

    runClokk(["stop", "--json"]);
  });

  it("starts a timer with project", () => {
    // Create a project first
    runClokk(["project", "create", "TestProject", "--json"]);

    const r = runClokk(["start", "Project work", "--project", "TestProject", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.project_id).toMatch(/^prj_/);

    runClokk(["stop", "--json"]);
  });

  it("starts a billable timer", () => {
    const r = runClokk(["start", "Billable work", "--billable", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.billable).toBe(true);

    runClokk(["stop", "--json"]);
  });

  it("fails when timer is already running", () => {
    runClokk(["start", "First", "--json"]);
    const r = runClokk(["start", "Second", "--json"]);
    expect(r.exitCode).not.toBe(0);
    const json = parseJson(r.stderr);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("TIMER_ALREADY_RUNNING");

    runClokk(["stop", "--json"]);
  });
});

// ─── stop ───────────────────────────────────────────────────────────

describe("clokk stop", () => {
  it("stops a running timer", () => {
    runClokk(["start", "To stop", "--json"]);
    const r = runClokk(["stop", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.ok).toBe(true);
    expect(json.data.end_time).not.toBeNull();
    expect(json.data.duration_seconds).toBeGreaterThanOrEqual(0);
  });

  it("stops and updates description", () => {
    runClokk(["start", "Original", "--json"]);
    const r = runClokk(["stop", "--description", "Updated desc", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.description).toBe("Updated desc");
  });

  it("stops and updates tags", () => {
    runClokk(["start", "Tag test", "--json"]);
    const r = runClokk(["stop", "--tags", "done,reviewed", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.tags).toEqual(["done", "reviewed"]);
  });

  it("fails when no timer is running", () => {
    const r = runClokk(["stop", "--json"]);
    expect(r.exitCode).not.toBe(0);
    const json = parseJson(r.stderr);
    expect(json.error.code).toBe("NO_TIMER_RUNNING");
  });
});

// ─── status ─────────────────────────────────────────────────────────

describe("clokk status", () => {
  it("shows running timer", () => {
    runClokk(["start", "Status check", "--json"]);
    const r = runClokk(["status", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.running).toBe(true);
    expect(json.data.entry.description).toBe("Status check");
    expect(json.data.elapsed_seconds).toBeGreaterThanOrEqual(0);

    runClokk(["stop", "--json"]);
  });

  it("shows no timer running", () => {
    const r = runClokk(["status", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.running).toBe(false);
  });
});

// ─── resume ─────────────────────────────────────────────────────────

describe("clokk resume", () => {
  it("resumes the last stopped timer", () => {
    runClokk(["start", "Resume me", "--tags", "feature", "--json"]);
    runClokk(["stop", "--json"]);

    const r = runClokk(["resume", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.description).toBe("Resume me");
    expect(json.data.tags).toEqual(["feature"]);
    expect(json.data.end_time).toBeNull();

    runClokk(["stop", "--json"]);
  });

  it("resumes a specific entry by ID", () => {
    runClokk(["start", "Specific", "--json"]);
    const stopResult = parseJson(runClokk(["stop", "--json"]).stdout);
    const entryId = stopResult.data.id;

    // Start and stop another entry so "last" is different
    runClokk(["start", "Other", "--json"]);
    runClokk(["stop", "--json"]);

    const r = runClokk(["resume", "--id", entryId, "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.description).toBe("Specific");

    runClokk(["stop", "--json"]);
  });

  it("fails when timer is already running", () => {
    runClokk(["start", "Running", "--json"]);
    const r = runClokk(["resume", "--json"]);
    expect(r.exitCode).not.toBe(0);
    const json = parseJson(r.stderr);
    expect(json.error.code).toBe("TIMER_ALREADY_RUNNING");

    runClokk(["stop", "--json"]);
  });
});

// ─── switch ─────────────────────────────────────────────────────────

describe("clokk switch", () => {
  it("stops current and starts new timer", () => {
    runClokk(["start", "Old task", "--json"]);
    const r = runClokk(["switch", "New task", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.stopped.description).toBe("Old task");
    expect(json.data.stopped.end_time).not.toBeNull();
    expect(json.data.started.description).toBe("New task");
    expect(json.data.started.end_time).toBeNull();

    runClokk(["stop", "--json"]);
  });

  it("switches with project and tags", () => {
    runClokk(["start", "Before switch", "--json"]);
    const r = runClokk(["switch", "After switch", "--project", "TestProject", "--tags", "new", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.started.project_id).toMatch(/^prj_/);
    expect(json.data.started.tags).toEqual(["new"]);

    runClokk(["stop", "--json"]);
  });

  it("fails when no timer is running", () => {
    const r = runClokk(["switch", "New task", "--json"]);
    expect(r.exitCode).not.toBe(0);
    const json = parseJson(r.stderr);
    expect(json.error.code).toBe("NO_TIMER_RUNNING");
  });
});

// ─── cancel ─────────────────────────────────────────────────────────

describe("clokk cancel", () => {
  it("cancels a running timer (auto-confirmed in non-TTY)", () => {
    runClokk(["start", "Cancel me", "--json"]);
    const r = runClokk(["cancel", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.description).toBe("Cancel me");

    // Verify timer is no longer running
    const status = parseJson(runClokk(["status", "--json"]).stdout);
    expect(status.data.running).toBe(false);
  });

  it("cancels with --yes flag", () => {
    runClokk(["start", "Cancel with yes", "--json"]);
    const r = runClokk(["cancel", "--yes", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = parseJson(r.stdout);
    expect(json.data.description).toBe("Cancel with yes");
  });

  it("fails when no timer is running", () => {
    const r = runClokk(["cancel", "--json"]);
    expect(r.exitCode).not.toBe(0);
    const json = parseJson(r.stderr);
    expect(json.error.code).toBe("NO_TIMER_RUNNING");
  });
});
