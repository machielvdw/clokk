import { beforeEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { SqliteRepository } from "@/data/sqlite.ts";
import * as schema from "@/data/schema.ts";
import type { Repository } from "@/data/repository.ts";
import {
  startTimer,
  stopTimer,
  getStatus,
  resumeTimer,
  switchTimer,
  cancelTimer,
} from "@/core/timer.ts";
import {
  TimerAlreadyRunningError,
  NoTimerRunningError,
  ProjectNotFoundError,
  EntryNotFoundError,
  NoEntriesFoundError,
} from "@/core/errors.ts";

let repo: Repository;

function createRepo(): Repository {
  const sqlite = new Database(":memory:");
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  return new SqliteRepository(sqlite);
}

beforeEach(() => {
  repo = createRepo();
});

// ─── startTimer ─────────────────────────────────────────────────

describe("startTimer", () => {
  it("creates a running entry", async () => {
    const entry = await startTimer(repo, { description: "Bug triage" });
    expect(entry.id).toStartWith("ent_");
    expect(entry.description).toBe("Bug triage");
    expect(entry.end_time).toBeNull();
    expect(entry.duration_seconds).toBeNull();
  });

  it("uses provided tags and billable", async () => {
    const entry = await startTimer(repo, {
      description: "Work",
      tags: ["backend"],
      billable: false,
    });
    expect(entry.tags).toEqual(["backend"]);
    expect(entry.billable).toBe(false);
  });

  it("resolves project by name", async () => {
    await repo.createProject({ id: "prj_test1", name: "Acme" });
    const entry = await startTimer(repo, {
      description: "Work",
      project: "Acme",
    });
    expect(entry.project_id).toBe("prj_test1");
  });

  it("resolves project by ID", async () => {
    await repo.createProject({ id: "prj_test1", name: "Acme" });
    const entry = await startTimer(repo, {
      description: "Work",
      project: "prj_test1",
    });
    expect(entry.project_id).toBe("prj_test1");
  });

  it("uses --at to override start time", async () => {
    const entry = await startTimer(repo, {
      description: "Backdated",
      at: "2026-02-26T09:00:00.000Z",
    });
    expect(entry.start_time).toBe("2026-02-26T09:00:00.000Z");
  });

  it("throws TimerAlreadyRunningError if timer is running", async () => {
    await startTimer(repo, { description: "First" });
    expect(startTimer(repo, { description: "Second" })).rejects.toBeInstanceOf(
      TimerAlreadyRunningError,
    );
  });

  it("throws ProjectNotFoundError for nonexistent project", async () => {
    expect(
      startTimer(repo, { description: "Work", project: "nonexistent" }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});

// ─── stopTimer ──────────────────────────────────────────────────

describe("stopTimer", () => {
  it("stops the running timer", async () => {
    await startTimer(repo, {
      description: "Work",
      at: "2026-02-26T09:00:00.000Z",
    });
    const stopped = await stopTimer(repo, {
      at: "2026-02-26T10:00:00.000Z",
    });
    expect(stopped.end_time).toBe("2026-02-26T10:00:00.000Z");
    expect(stopped.duration_seconds).toBe(3600);
  });

  it("updates description and tags on stop", async () => {
    await startTimer(repo, { description: "Initial" });
    const stopped = await stopTimer(repo, {
      description: "Updated",
      tags: ["review"],
    });
    expect(stopped.description).toBe("Updated");
    expect(stopped.tags).toEqual(["review"]);
  });

  it("throws NoTimerRunningError when nothing running", async () => {
    expect(stopTimer(repo)).rejects.toBeInstanceOf(NoTimerRunningError);
  });
});

// ─── getStatus ──────────────────────────────────────────────────

describe("getStatus", () => {
  it("returns running status with entry and elapsed", async () => {
    await startTimer(repo, {
      description: "Work",
      at: new Date(Date.now() - 60_000).toISOString(),
    });
    const status = await getStatus(repo);
    expect(status.running).toBe(true);
    expect(status.entry).toBeDefined();
    expect(status.entry!.description).toBe("Work");
    expect(status.elapsed_seconds).toBeGreaterThanOrEqual(59);
    expect(status.elapsed_seconds).toBeLessThanOrEqual(62);
  });

  it("returns not running when no timer active", async () => {
    const status = await getStatus(repo);
    expect(status.running).toBe(false);
    expect(status.entry).toBeUndefined();
    expect(status.elapsed_seconds).toBeUndefined();
  });
});

// ─── resumeTimer ────────────────────────────────────────────────

describe("resumeTimer", () => {
  it("resumes the most recent stopped entry", async () => {
    await startTimer(repo, {
      description: "First task",
      at: "2026-02-26T09:00:00.000Z",
    });
    await stopTimer(repo, { at: "2026-02-26T10:00:00.000Z" });

    await startTimer(repo, {
      description: "Second task",
      at: "2026-02-26T10:00:00.000Z",
    });
    await stopTimer(repo, { at: "2026-02-26T11:00:00.000Z" });

    const resumed = await resumeTimer(repo);
    expect(resumed.description).toBe("Second task");
    expect(resumed.end_time).toBeNull();
    expect(resumed.id).not.toBe("ent_test1"); // new ID
  });

  it("resumes a specific entry by ID", async () => {
    const first = await startTimer(repo, {
      description: "First task",
      tags: ["backend"],
      at: "2026-02-26T09:00:00.000Z",
    });
    await stopTimer(repo, { at: "2026-02-26T10:00:00.000Z" });

    await startTimer(repo, {
      description: "Second task",
      at: "2026-02-26T10:00:00.000Z",
    });
    await stopTimer(repo, { at: "2026-02-26T11:00:00.000Z" });

    const resumed = await resumeTimer(repo, { id: first.id });
    expect(resumed.description).toBe("First task");
    expect(resumed.tags).toEqual(["backend"]);
    expect(resumed.end_time).toBeNull();
  });

  it("copies project, tags, and billable from source", async () => {
    await repo.createProject({ id: "prj_1", name: "Acme" });
    const entry = await startTimer(repo, {
      description: "Work",
      project: "Acme",
      tags: ["dev", "urgent"],
      billable: false,
      at: "2026-02-26T09:00:00.000Z",
    });
    await stopTimer(repo, { at: "2026-02-26T10:00:00.000Z" });

    const resumed = await resumeTimer(repo);
    expect(resumed.project_id).toBe("prj_1");
    expect(resumed.tags).toEqual(["dev", "urgent"]);
    expect(resumed.billable).toBe(false);
  });

  it("throws TimerAlreadyRunningError if timer is running", async () => {
    await startTimer(repo, { description: "Running" });
    expect(resumeTimer(repo)).rejects.toBeInstanceOf(
      TimerAlreadyRunningError,
    );
  });

  it("throws EntryNotFoundError for nonexistent entry ID", async () => {
    expect(
      resumeTimer(repo, { id: "ent_nonexistent" }),
    ).rejects.toBeInstanceOf(EntryNotFoundError);
  });

  it("throws NoEntriesFoundError when no previous entries", async () => {
    expect(resumeTimer(repo)).rejects.toBeInstanceOf(NoEntriesFoundError);
  });
});

// ─── switchTimer ────────────────────────────────────────────────

describe("switchTimer", () => {
  it("stops current and starts new timer", async () => {
    await startTimer(repo, {
      description: "Old task",
      at: "2026-02-26T09:00:00.000Z",
    });
    const result = await switchTimer(repo, { description: "New task" });

    expect(result.stopped.description).toBe("Old task");
    expect(result.stopped.end_time).not.toBeNull();

    expect(result.started.description).toBe("New task");
    expect(result.started.end_time).toBeNull();
  });

  it("assigns project to new timer", async () => {
    await repo.createProject({ id: "prj_1", name: "Acme" });
    await startTimer(repo, { description: "Old task" });
    const result = await switchTimer(repo, {
      description: "New task",
      project: "Acme",
    });
    expect(result.started.project_id).toBe("prj_1");
  });

  it("throws NoTimerRunningError when nothing running", async () => {
    expect(
      switchTimer(repo, { description: "New task" }),
    ).rejects.toBeInstanceOf(NoTimerRunningError);
  });
});

// ─── cancelTimer ────────────────────────────────────────────────

describe("cancelTimer", () => {
  it("deletes the running timer", async () => {
    const started = await startTimer(repo, { description: "Discard this" });
    const cancelled = await cancelTimer(repo);
    expect(cancelled.id).toBe(started.id);

    // Verify it's gone
    const status = await getStatus(repo);
    expect(status.running).toBe(false);
  });

  it("throws NoTimerRunningError when nothing running", async () => {
    expect(cancelTimer(repo)).rejects.toBeInstanceOf(NoTimerRunningError);
  });
});
