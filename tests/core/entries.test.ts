import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { deleteEntry, editEntry, listEntries, logEntry } from "@/core/entries.ts";
import { EntryNotFoundError, ProjectNotFoundError, ValidationError } from "@/core/errors.ts";
import type { Repository } from "@/data/repository.ts";
import * as schema from "@/data/schema.ts";
import { SqliteRepository } from "@/data/sqlite.ts";

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

// ─── logEntry ───────────────────────────────────────────────────

describe("logEntry", () => {
  it("creates an entry with --to", async () => {
    const entry = await logEntry(repo, {
      description: "Morning standup",
      from: "2026-02-26T09:00:00.000Z",
      to: "2026-02-26T09:30:00.000Z",
    });
    expect(entry.id).toStartWith("ent_");
    expect(entry.description).toBe("Morning standup");
    expect(entry.start_time).toBe("2026-02-26T09:00:00.000Z");
    expect(entry.end_time).toBe("2026-02-26T09:30:00.000Z");
    expect(entry.duration_seconds).toBe(1800);
  });

  it("creates an entry with --duration", async () => {
    const entry = await logEntry(repo, {
      description: "Deep work",
      from: "2026-02-26T09:00:00.000Z",
      duration: 5400, // 1h 30m
    });
    expect(entry.end_time).toBe("2026-02-26T10:30:00.000Z");
    expect(entry.duration_seconds).toBe(5400);
  });

  it("resolves project by name", async () => {
    await repo.createProject({ id: "prj_1", name: "Acme" });
    const entry = await logEntry(repo, {
      from: "2026-02-26T09:00:00.000Z",
      to: "2026-02-26T10:00:00.000Z",
      project: "Acme",
    });
    expect(entry.project_id).toBe("prj_1");
  });

  it("sets tags and billable", async () => {
    const entry = await logEntry(repo, {
      from: "2026-02-26T09:00:00.000Z",
      to: "2026-02-26T10:00:00.000Z",
      tags: ["meeting", "client"],
      billable: false,
    });
    expect(entry.tags).toEqual(["meeting", "client"]);
    expect(entry.billable).toBe(false);
  });

  it("throws when both --to and --duration provided", async () => {
    expect(
      logEntry(repo, {
        from: "2026-02-26T09:00:00.000Z",
        to: "2026-02-26T10:00:00.000Z",
        duration: 3600,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws when neither --to nor --duration provided", async () => {
    expect(logEntry(repo, { from: "2026-02-26T09:00:00.000Z" })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("throws when end time is before start time", async () => {
    expect(
      logEntry(repo, {
        from: "2026-02-26T10:00:00.000Z",
        to: "2026-02-26T09:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws when end time equals start time", async () => {
    expect(
      logEntry(repo, {
        from: "2026-02-26T09:00:00.000Z",
        to: "2026-02-26T09:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws ProjectNotFoundError for nonexistent project", async () => {
    expect(
      logEntry(repo, {
        from: "2026-02-26T09:00:00.000Z",
        to: "2026-02-26T10:00:00.000Z",
        project: "nonexistent",
      }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});

// ─── editEntry ──────────────────────────────────────────────────

describe("editEntry", () => {
  it("updates description", async () => {
    const entry = await logEntry(repo, {
      description: "Old",
      from: "2026-02-26T09:00:00.000Z",
      to: "2026-02-26T10:00:00.000Z",
    });
    const updated = await editEntry(repo, entry.id, {
      description: "New description",
    });
    expect(updated.description).toBe("New description");
  });

  it("updates project", async () => {
    await repo.createProject({ id: "prj_1", name: "Acme" });
    const entry = await logEntry(repo, {
      from: "2026-02-26T09:00:00.000Z",
      to: "2026-02-26T10:00:00.000Z",
    });
    const updated = await editEntry(repo, entry.id, { project: "Acme" });
    expect(updated.project_id).toBe("prj_1");
  });

  it("clears project when set to null", async () => {
    await repo.createProject({ id: "prj_1", name: "Acme" });
    const entry = await logEntry(repo, {
      from: "2026-02-26T09:00:00.000Z",
      to: "2026-02-26T10:00:00.000Z",
      project: "Acme",
    });
    const updated = await editEntry(repo, entry.id, { project: null });
    expect(updated.project_id).toBeNull();
  });

  it("updates time range", async () => {
    const entry = await logEntry(repo, {
      from: "2026-02-26T09:00:00.000Z",
      to: "2026-02-26T10:00:00.000Z",
    });
    const updated = await editEntry(repo, entry.id, {
      start_time: "2026-02-26T08:00:00.000Z",
      end_time: "2026-02-26T11:00:00.000Z",
    });
    expect(updated.start_time).toBe("2026-02-26T08:00:00.000Z");
    expect(updated.end_time).toBe("2026-02-26T11:00:00.000Z");
    expect(updated.duration_seconds).toBe(10800);
  });

  it("updates tags and billable", async () => {
    const entry = await logEntry(repo, {
      from: "2026-02-26T09:00:00.000Z",
      to: "2026-02-26T10:00:00.000Z",
      tags: ["old"],
      billable: true,
    });
    const updated = await editEntry(repo, entry.id, {
      tags: ["new", "updated"],
      billable: false,
    });
    expect(updated.tags).toEqual(["new", "updated"]);
    expect(updated.billable).toBe(false);
  });

  it("throws ValidationError when edited times are invalid", async () => {
    const entry = await logEntry(repo, {
      from: "2026-02-26T09:00:00.000Z",
      to: "2026-02-26T10:00:00.000Z",
    });
    expect(
      editEntry(repo, entry.id, {
        start_time: "2026-02-26T11:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws EntryNotFoundError for nonexistent entry", async () => {
    expect(editEntry(repo, "ent_nonexistent", { description: "Updated" })).rejects.toBeInstanceOf(
      EntryNotFoundError,
    );
  });

  it("throws ProjectNotFoundError for nonexistent project", async () => {
    const entry = await logEntry(repo, {
      from: "2026-02-26T09:00:00.000Z",
      to: "2026-02-26T10:00:00.000Z",
    });
    expect(editEntry(repo, entry.id, { project: "nonexistent" })).rejects.toBeInstanceOf(
      ProjectNotFoundError,
    );
  });
});

// ─── deleteEntry ────────────────────────────────────────────────

describe("deleteEntry", () => {
  it("deletes an entry and returns it", async () => {
    const entry = await logEntry(repo, {
      description: "To delete",
      from: "2026-02-26T09:00:00.000Z",
      to: "2026-02-26T10:00:00.000Z",
    });
    const deleted = await deleteEntry(repo, entry.id);
    expect(deleted.id).toBe(entry.id);

    // Verify it's gone
    const result = await listEntries(repo);
    expect(result.entries).toHaveLength(0);
  });

  it("throws EntryNotFoundError for nonexistent entry", async () => {
    expect(deleteEntry(repo, "ent_nonexistent")).rejects.toBeInstanceOf(EntryNotFoundError);
  });
});

// ─── listEntries ────────────────────────────────────────────────

describe("listEntries", () => {
  it("returns entries with pagination defaults", async () => {
    await logEntry(repo, {
      from: "2026-02-26T09:00:00.000Z",
      to: "2026-02-26T10:00:00.000Z",
    });
    await logEntry(repo, {
      from: "2026-02-26T10:00:00.000Z",
      to: "2026-02-26T11:00:00.000Z",
    });

    const result = await listEntries(repo);
    expect(result.entries).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it("respects custom limit and offset", async () => {
    for (let i = 0; i < 5; i++) {
      await logEntry(repo, {
        description: `Entry ${i}`,
        from: `2026-02-26T${String(9 + i).padStart(2, "0")}:00:00.000Z`,
        to: `2026-02-26T${String(10 + i).padStart(2, "0")}:00:00.000Z`,
      });
    }

    const result = await listEntries(repo, { limit: 2, offset: 1 });
    expect(result.entries).toHaveLength(2);
    expect(result.total).toBe(5);
    expect(result.limit).toBe(2);
    expect(result.offset).toBe(1);
  });

  it("filters by project", async () => {
    await repo.createProject({ id: "prj_1", name: "Acme" });
    await logEntry(repo, {
      from: "2026-02-26T09:00:00.000Z",
      to: "2026-02-26T10:00:00.000Z",
      project: "Acme",
    });
    await logEntry(repo, {
      from: "2026-02-26T10:00:00.000Z",
      to: "2026-02-26T11:00:00.000Z",
    });

    const result = await listEntries(repo, { project_id: "prj_1" });
    expect(result.entries).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});
