/**
 * Agent Workflow Tests — spec §9.1–§9.9
 *
 * Each test simulates a real agent workflow story from the tech spec.
 * Commands run via Bun.spawnSync with isolated CLOKK_DIR, asserting on
 * JSON envelopes exactly as an agent would parse them.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "../..");

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "clokk-workflow-"));

  // Seed projects needed by workflow stories
  run(["project", "create", "team-meetings", "--json"]);
  run(["project", "create", "acme", "--client", "Acme Corp", "--rate", "150", "--currency", "USD", "--json"]);
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function run(args: string[]): { stdout: string; stderr: string; exitCode: number } {
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

function json(stdout: string) {
  return JSON.parse(stdout);
}

// ─── §9.1 — Track a day of work ────────────────────────────────────

describe("§9.1 — Track a day of work", () => {
  it("starts standup, switches to feature work, switches to review, stops", () => {
    // Start standup
    const start = json(
      run(["start", "Standup", "--project", "team-meetings", "--tags", "sync", "--json"]).stdout,
    );
    expect(start.ok).toBe(true);
    expect(start.data.description).toBe("Standup");
    expect(start.data.end_time).toBeNull();

    // Switch to feature work
    const sw1 = json(
      run(["switch", "Feature: auth flow", "--project", "acme", "--tags", "backend,auth", "--json"]).stdout,
    );
    expect(sw1.ok).toBe(true);
    expect(sw1.data.stopped.description).toBe("Standup");
    expect(sw1.data.stopped.end_time).not.toBeNull();
    expect(sw1.data.started.description).toBe("Feature: auth flow");

    // Switch to code review
    const sw2 = json(
      run(["switch", "Code review", "--project", "acme", "--tags", "review", "--json"]).stdout,
    );
    expect(sw2.ok).toBe(true);
    expect(sw2.data.stopped.description).toBe("Feature: auth flow");
    expect(sw2.data.started.description).toBe("Code review");

    // Stop
    const stop = json(run(["stop", "--json"]).stdout);
    expect(stop.ok).toBe(true);
    expect(stop.data.description).toBe("Code review");
    expect(stop.data.end_time).not.toBeNull();
    expect(stop.data.duration_seconds).toBeGreaterThanOrEqual(0);

    // Verify: list shows all 3 completed entries
    const list = json(run(["list", "--json"]).stdout);
    const descs = list.data.entries.map((e: { description: string }) => e.description);
    expect(descs).toContain("Standup");
    expect(descs).toContain("Feature: auth flow");
    expect(descs).toContain("Code review");
  });
});

// ─── §9.2 — Check what's running and how long ──────────────────────

describe("§9.2 — Check what's running", () => {
  it("reports running timer with elapsed seconds", () => {
    run(["start", "Deep focus", "--project", "acme", "--json"]);

    const status = json(run(["status", "--json"]).stdout);
    expect(status.ok).toBe(true);
    expect(status.data.running).toBe(true);
    expect(status.data.entry.description).toBe("Deep focus");
    expect(status.data.elapsed_seconds).toBeGreaterThanOrEqual(0);

    run(["stop", "--json"]);
  });

  it("reports no timer running when idle", () => {
    const status = json(run(["status", "--json"]).stdout);
    expect(status.data.running).toBe(false);
  });
});

// ─── §9.3 — Log time retroactively ─────────────────────────────────

describe("§9.3 — Log time retroactively", () => {
  it("logs a completed entry with from/to and tags", () => {
    const r = json(
      run([
        "log", "Client call",
        "--project", "acme",
        "--from", "2026-02-27T14:00:00Z",
        "--to", "2026-02-27T15:30:00Z",
        "--tags", "meeting",
        "--billable",
        "--json",
      ]).stdout,
    );
    expect(r.ok).toBe(true);
    expect(r.data.description).toBe("Client call");
    expect(r.data.duration_seconds).toBe(5400); // 1.5 hours
    expect(r.data.tags).toEqual(["meeting"]);
    expect(r.data.billable).toBe(true);
    expect(r.data.project_id).toMatch(/^prj_/);
  });

  it("logs an entry with duration instead of to", () => {
    const r = json(
      run([
        "log", "Pairing session",
        "--from", "2026-02-27T10:00:00Z",
        "--duration", "2h",
        "--json",
      ]).stdout,
    );
    expect(r.data.duration_seconds).toBe(7200);
  });
});

// ─── §9.4 — Generate a weekly summary for standup ───────────────────

describe("§9.4 — Weekly summary", () => {
  it("generates a report grouped by day", () => {
    const r = json(run(["report", "--week", "--group-by", "day", "--json"]).stdout);
    expect(r.ok).toBe(true);
    expect(r.data.total_seconds).toBeGreaterThan(0);
    expect(r.data.groups.length).toBeGreaterThan(0);
    // Day groups should be date-formatted keys
    expect(r.data.groups[0].key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.data.groups[0].entry_count).toBeGreaterThan(0);
  });
});

// ─── §9.5 — Find out how much to bill a client ─────────────────────

describe("§9.5 — Billing report", () => {
  it("returns billable amount for project with rate", () => {
    // acme project has rate=150 USD
    const r = json(run(["report", "--project", "acme", "--month", "--json"]).stdout);
    expect(r.ok).toBe(true);
    expect(r.data.total_seconds).toBeGreaterThan(0);
    expect(r.data.billable_seconds).toBeGreaterThanOrEqual(0);

    // Find the acme group (grouped by project by default)
    const acmeGroup = r.data.groups.find(
      (g: { key: string }) => g.key === "acme" || g.key === "Acme Corp",
    );
    // There should be entries for acme
    if (acmeGroup) {
      expect(acmeGroup.entry_count).toBeGreaterThan(0);
      // If there are billable entries, billable_amount should be computed
      if (acmeGroup.billable_seconds > 0) {
        expect(acmeGroup.billable_amount).toBeGreaterThan(0);
        expect(acmeGroup.currency).toBe("USD");
      }
    }
  });
});

// ─── §9.6 — Fix a mistake ──────────────────────────────────────────

describe("§9.6 — Fix a mistake", () => {
  it("lists entries, picks one, edits its times", () => {
    // Log an entry with a "mistake"
    const logged = json(
      run([
        "log", "Meeting with wrong times",
        "--from", "2026-02-27T09:00:00Z",
        "--to", "2026-02-27T10:00:00Z",
        "--json",
      ]).stdout,
    );
    const entryId = logged.data.id;

    // Agent discovers the entry via list
    const list = json(run(["list", "--json"]).stdout);
    const found = list.data.entries.find(
      (e: { id: string }) => e.id === entryId,
    );
    expect(found).toBeDefined();

    // Fix the times
    const edited = json(
      run([
        "edit", entryId,
        "--from", "2026-02-27T09:00:00Z",
        "--to", "2026-02-27T10:30:00Z",
        "--json",
      ]).stdout,
    );
    expect(edited.ok).toBe(true);
    expect(edited.data.end_time).toBe("2026-02-27T10:30:00.000Z");
    expect(edited.data.duration_seconds).toBe(5400); // 1.5h
  });
});

// ─── §9.7 — Set up a new project ───────────────────────────────────

describe("§9.7 — Set up a new project", () => {
  it("creates a project with client and rate", () => {
    const r = json(
      run([
        "project", "create", "acme-redesign",
        "--client", "Acme Corp",
        "--rate", "150",
        "--currency", "USD",
        "--json",
      ]).stdout,
    );
    expect(r.ok).toBe(true);
    expect(r.data.name).toBe("acme-redesign");
    expect(r.data.client).toBe("Acme Corp");
    expect(r.data.rate).toBe(150);
    expect(r.data.currency).toBe("USD");
    expect(r.data.id).toMatch(/^prj_/);
  });
});

// ─── §9.8 — Export for invoicing ────────────────────────────────────

describe("§9.8 — Export for invoicing", () => {
  it("exports CSV to a file", () => {
    const outPath = join(tmpDir, "acme-feb-2026.csv");
    const r = run([
      "export",
      "--project", "acme",
      "--month",
      "--format", "csv",
      "--output", outPath,
      "--json",
    ]);
    expect(r.exitCode).toBe(0);
    expect(existsSync(outPath)).toBe(true);

    const csv = readFileSync(outPath, "utf-8");
    expect(csv).toContain("id,description,project");
    // Should contain at least the acme entries we created
    expect(csv).toContain("acme");
  });

  it("exports JSON to stdout", () => {
    const r = run([
      "export",
      "--project", "acme",
      "--month",
      "--format", "json",
    ]);
    expect(r.exitCode).toBe(0);
    const entries = JSON.parse(r.stdout);
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].description).toBeDefined();
  });
});

// ─── §9.9 — Agent self-onboarding ──────────────────────────────────

describe("§9.9 — Agent self-onboarding", () => {
  it("schema returns complete CLI interface as JSON", () => {
    const r = run(["schema"]);
    expect(r.exitCode).toBe(0);

    const schema = JSON.parse(r.stdout);
    expect(schema.name).toBe("clokk");
    expect(schema.subCommands).toBeDefined();
    expect(Array.isArray(schema.subCommands)).toBe(true);

    const names = schema.subCommands.map((c: { name: string }) => c.name);
    expect(names).toContain("start");
    expect(names).toContain("stop");
    expect(names).toContain("status");
    expect(names).toContain("resume");
    expect(names).toContain("switch");
    expect(names).toContain("cancel");
    expect(names).toContain("log");
    expect(names).toContain("edit");
    expect(names).toContain("delete");
    expect(names).toContain("list");
    expect(names).toContain("project");
    expect(names).toContain("report");
    expect(names).toContain("export");
    expect(names).toContain("config");
    expect(names).toContain("schema");
    expect(names).toContain("commands");
  });

  it("commands returns all available commands", () => {
    const r = json(run(["commands", "--json"]).stdout);
    expect(r.ok).toBe(true);
    expect(r.data.length).toBe(19);
    // Every command has name and description
    for (const cmd of r.data) {
      expect(cmd.name).toBeDefined();
      expect(cmd.description).toBeDefined();
      expect(cmd.description.length).toBeGreaterThan(0);
    }
  });

  it("schema includes args for subcommands", () => {
    const schema = JSON.parse(run(["schema"]).stdout);
    const startCmd = schema.subCommands.find(
      (c: { name: string }) => c.name === "start",
    );
    expect(startCmd).toBeDefined();
    expect(startCmd.args.description).toBeDefined();
    expect(startCmd.args.project).toBeDefined();
    expect(startCmd.args.tags).toBeDefined();
  });
});
