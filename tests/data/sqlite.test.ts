import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { EntryNotFoundError, ProjectHasEntriesError, ProjectNotFoundError } from "@/core/errors.ts";
import * as schema from "@/data/schema.ts";
import { SqliteRepository } from "@/data/sqlite.ts";

let repo: SqliteRepository;

function createRepo(): SqliteRepository {
  const sqlite = new Database(":memory:");
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  // Access the underlying sqlite instance via a workaround:
  // SqliteRepository needs the raw Database, so we pass it directly
  return new SqliteRepository(sqlite);
}

beforeEach(() => {
  repo = createRepo();
});

// ─── Entry CRUD ─────────────────────────────────────────────────

describe("entries", () => {
  describe("createEntry", () => {
    it("creates an entry and returns it", async () => {
      const entry = await repo.createEntry({
        id: "ent_test1",
        description: "Bug triage",
        start_time: "2026-02-26T09:00:00.000Z",
        tags: ["backend", "urgent"],
        billable: true,
      });

      expect(entry.id).toBe("ent_test1");
      expect(entry.description).toBe("Bug triage");
      expect(entry.start_time).toBe("2026-02-26T09:00:00.000Z");
      expect(entry.end_time).toBeNull();
      expect(entry.tags).toEqual(["backend", "urgent"]);
      expect(entry.billable).toBe(true);
      expect(entry.duration_seconds).toBeNull(); // running
      expect(entry.created_at).toBeTruthy();
    });

    it("creates entry with project reference", async () => {
      await repo.createProject({ id: "prj_1", name: "Acme" });
      const entry = await repo.createEntry({
        id: "ent_1",
        project_id: "prj_1",
        start_time: "2026-02-26T09:00:00.000Z",
      });
      expect(entry.project_id).toBe("prj_1");
    });

    it("defaults description to empty string", async () => {
      const entry = await repo.createEntry({
        id: "ent_1",
        start_time: "2026-02-26T09:00:00.000Z",
      });
      expect(entry.description).toBe("");
    });

    it("defaults tags to empty array", async () => {
      const entry = await repo.createEntry({
        id: "ent_1",
        start_time: "2026-02-26T09:00:00.000Z",
      });
      expect(entry.tags).toEqual([]);
    });
  });

  describe("getEntry", () => {
    it("returns entry by ID", async () => {
      await repo.createEntry({
        id: "ent_1",
        start_time: "2026-02-26T09:00:00.000Z",
      });
      const entry = await repo.getEntry("ent_1");
      expect(entry).not.toBeNull();
      expect(entry!.id).toBe("ent_1");
    });

    it("returns null for nonexistent ID", async () => {
      const entry = await repo.getEntry("ent_nonexistent");
      expect(entry).toBeNull();
    });
  });

  describe("updateEntry", () => {
    it("updates description", async () => {
      await repo.createEntry({
        id: "ent_1",
        description: "Old",
        start_time: "2026-02-26T09:00:00.000Z",
      });
      const updated = await repo.updateEntry("ent_1", {
        description: "New",
      });
      expect(updated.description).toBe("New");
    });

    it("updates end_time and computes duration", async () => {
      await repo.createEntry({
        id: "ent_1",
        start_time: "2026-02-26T09:00:00.000Z",
      });
      const updated = await repo.updateEntry("ent_1", {
        end_time: "2026-02-26T10:30:00.000Z",
      });
      expect(updated.end_time).toBe("2026-02-26T10:30:00.000Z");
      expect(updated.duration_seconds).toBe(5400); // 1.5 hours
    });

    it("updates tags", async () => {
      await repo.createEntry({
        id: "ent_1",
        start_time: "2026-02-26T09:00:00.000Z",
        tags: ["old"],
      });
      const updated = await repo.updateEntry("ent_1", {
        tags: ["new", "tags"],
      });
      expect(updated.tags).toEqual(["new", "tags"]);
    });

    it("updates billable status", async () => {
      await repo.createEntry({
        id: "ent_1",
        start_time: "2026-02-26T09:00:00.000Z",
        billable: true,
      });
      const updated = await repo.updateEntry("ent_1", { billable: false });
      expect(updated.billable).toBe(false);
    });

    it("updates updated_at timestamp", async () => {
      await repo.createEntry({
        id: "ent_1",
        start_time: "2026-02-26T09:00:00.000Z",
      });
      const before = (await repo.getEntry("ent_1"))!.updated_at;
      // Small delay to ensure timestamp changes
      await new Promise((r) => setTimeout(r, 10));
      const updated = await repo.updateEntry("ent_1", { description: "x" });
      expect(updated.updated_at).not.toBe(before);
    });

    it("throws EntryNotFoundError for nonexistent entry", async () => {
      expect(repo.updateEntry("ent_nope", { description: "x" })).rejects.toBeInstanceOf(
        EntryNotFoundError,
      );
    });
  });

  describe("deleteEntry", () => {
    it("deletes and returns the entry", async () => {
      await repo.createEntry({
        id: "ent_1",
        description: "To delete",
        start_time: "2026-02-26T09:00:00.000Z",
      });
      const deleted = await repo.deleteEntry("ent_1");
      expect(deleted.id).toBe("ent_1");
      expect(deleted.description).toBe("To delete");

      const found = await repo.getEntry("ent_1");
      expect(found).toBeNull();
    });

    it("throws EntryNotFoundError for nonexistent entry", async () => {
      expect(repo.deleteEntry("ent_nope")).rejects.toBeInstanceOf(EntryNotFoundError);
    });
  });

  describe("getRunningEntry", () => {
    it("returns entry with null end_time", async () => {
      await repo.createEntry({
        id: "ent_running",
        start_time: "2026-02-26T09:00:00.000Z",
      });
      const running = await repo.getRunningEntry();
      expect(running).not.toBeNull();
      expect(running!.id).toBe("ent_running");
      expect(running!.end_time).toBeNull();
    });

    it("returns null when no running entry", async () => {
      await repo.createEntry({
        id: "ent_done",
        start_time: "2026-02-26T09:00:00.000Z",
        end_time: "2026-02-26T10:00:00.000Z",
      });
      const running = await repo.getRunningEntry();
      expect(running).toBeNull();
    });

    it("ignores completed entries", async () => {
      await repo.createEntry({
        id: "ent_done",
        start_time: "2026-02-26T08:00:00.000Z",
        end_time: "2026-02-26T09:00:00.000Z",
      });
      await repo.createEntry({
        id: "ent_running",
        start_time: "2026-02-26T09:00:00.000Z",
      });
      const running = await repo.getRunningEntry();
      expect(running!.id).toBe("ent_running");
    });
  });

  describe("listEntries", () => {
    async function seedEntries() {
      await repo.createProject({ id: "prj_acme", name: "Acme" });
      await repo.createProject({ id: "prj_side", name: "Side" });

      await repo.createEntry({
        id: "ent_1",
        project_id: "prj_acme",
        description: "Task 1",
        start_time: "2026-02-24T09:00:00.000Z",
        end_time: "2026-02-24T10:00:00.000Z",
        tags: ["backend"],
        billable: true,
      });
      await repo.createEntry({
        id: "ent_2",
        project_id: "prj_acme",
        description: "Task 2",
        start_time: "2026-02-25T09:00:00.000Z",
        end_time: "2026-02-25T11:00:00.000Z",
        tags: ["backend", "urgent"],
        billable: false,
      });
      await repo.createEntry({
        id: "ent_3",
        project_id: "prj_side",
        description: "Side task",
        start_time: "2026-02-26T09:00:00.000Z",
        tags: ["frontend"],
        billable: true,
      });
    }

    it("returns all entries with default pagination", async () => {
      await seedEntries();
      const result = await repo.listEntries({});
      expect(result.entries).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it("orders by start_time descending", async () => {
      await seedEntries();
      const result = await repo.listEntries({});
      expect(result.entries[0]!.id).toBe("ent_3"); // most recent
      expect(result.entries[2]!.id).toBe("ent_1"); // oldest
    });

    it("filters by project_id", async () => {
      await seedEntries();
      const result = await repo.listEntries({ project_id: "prj_acme" });
      expect(result.entries).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("filters by date range (from/to)", async () => {
      await seedEntries();
      const result = await repo.listEntries({
        from: "2026-02-25T00:00:00.000Z",
        to: "2026-02-25T23:59:59.000Z",
      });
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]!.id).toBe("ent_2");
    });

    it("filters by tags (AND logic)", async () => {
      await seedEntries();
      const result = await repo.listEntries({ tags: ["backend", "urgent"] });
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]!.id).toBe("ent_2");
    });

    it("filters by single tag", async () => {
      await seedEntries();
      const result = await repo.listEntries({ tags: ["backend"] });
      expect(result.entries).toHaveLength(2);
    });

    it("filters by billable", async () => {
      await seedEntries();
      const result = await repo.listEntries({ billable: false });
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]!.id).toBe("ent_2");
    });

    it("filters by running", async () => {
      await seedEntries();
      const result = await repo.listEntries({ running: true });
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]!.id).toBe("ent_3"); // no end_time
    });

    it("filters by not running", async () => {
      await seedEntries();
      const result = await repo.listEntries({ running: false });
      expect(result.entries).toHaveLength(2);
    });

    it("paginates with limit and offset", async () => {
      await seedEntries();
      const page1 = await repo.listEntries({ limit: 2, offset: 0 });
      expect(page1.entries).toHaveLength(2);
      expect(page1.total).toBe(3);

      const page2 = await repo.listEntries({ limit: 2, offset: 2 });
      expect(page2.entries).toHaveLength(1);
      expect(page2.total).toBe(3);
    });
  });

  describe("duration_seconds computation", () => {
    it("computes duration for completed entries", async () => {
      const entry = await repo.createEntry({
        id: "ent_1",
        start_time: "2026-02-26T09:00:00.000Z",
        end_time: "2026-02-26T10:30:00.000Z",
      });
      expect(entry.duration_seconds).toBe(5400);
    });

    it("returns null for running entries", async () => {
      const entry = await repo.createEntry({
        id: "ent_1",
        start_time: "2026-02-26T09:00:00.000Z",
      });
      expect(entry.duration_seconds).toBeNull();
    });
  });

  describe("tags round-trip", () => {
    it("preserves tags through create and read", async () => {
      await repo.createEntry({
        id: "ent_1",
        start_time: "2026-02-26T09:00:00.000Z",
        tags: ["backend", "urgent", "api"],
      });
      const entry = await repo.getEntry("ent_1");
      expect(entry!.tags).toEqual(["backend", "urgent", "api"]);
    });

    it("handles empty tags array", async () => {
      await repo.createEntry({
        id: "ent_1",
        start_time: "2026-02-26T09:00:00.000Z",
        tags: [],
      });
      const entry = await repo.getEntry("ent_1");
      expect(entry!.tags).toEqual([]);
    });
  });
});

// ─── Project CRUD ───────────────────────────────────────────────

describe("projects", () => {
  describe("createProject", () => {
    it("creates a project and returns it", async () => {
      const project = await repo.createProject({
        id: "prj_1",
        name: "Acme",
        client: "Acme Corp",
        rate: 150,
        currency: "USD",
        color: "#ff0000",
      });

      expect(project.id).toBe("prj_1");
      expect(project.name).toBe("Acme");
      expect(project.client).toBe("Acme Corp");
      expect(project.rate).toBe(150);
      expect(project.currency).toBe("USD");
      expect(project.color).toBe("#ff0000");
      expect(project.archived).toBe(false);
    });

    it("defaults currency to USD", async () => {
      const project = await repo.createProject({ id: "prj_1", name: "Test" });
      expect(project.currency).toBe("USD");
    });
  });

  describe("getProject", () => {
    it("gets project by ID", async () => {
      await repo.createProject({ id: "prj_1", name: "Acme" });
      const project = await repo.getProject("prj_1");
      expect(project!.name).toBe("Acme");
    });

    it("gets project by name", async () => {
      await repo.createProject({ id: "prj_1", name: "Acme" });
      const project = await repo.getProject("Acme");
      expect(project!.id).toBe("prj_1");
    });

    it("returns null for nonexistent project", async () => {
      const project = await repo.getProject("nonexistent");
      expect(project).toBeNull();
    });
  });

  describe("updateProject", () => {
    it("updates project fields", async () => {
      await repo.createProject({ id: "prj_1", name: "Old" });
      const updated = await repo.updateProject("prj_1", {
        name: "New",
        client: "New Corp",
        rate: 200,
      });
      expect(updated.name).toBe("New");
      expect(updated.client).toBe("New Corp");
      expect(updated.rate).toBe(200);
    });

    it("archives a project", async () => {
      await repo.createProject({ id: "prj_1", name: "Test" });
      const updated = await repo.updateProject("prj_1", { archived: true });
      expect(updated.archived).toBe(true);
    });

    it("throws ProjectNotFoundError for nonexistent project", async () => {
      expect(repo.updateProject("prj_nope", { name: "x" })).rejects.toBeInstanceOf(
        ProjectNotFoundError,
      );
    });
  });

  describe("deleteProject", () => {
    it("deletes project without entries", async () => {
      await repo.createProject({ id: "prj_1", name: "Empty" });
      const deleted = await repo.deleteProject("prj_1", {});
      expect(deleted.name).toBe("Empty");

      const found = await repo.getProject("prj_1");
      expect(found).toBeNull();
    });

    it("throws ProjectHasEntriesError when entries exist", async () => {
      await repo.createProject({ id: "prj_1", name: "Has entries" });
      await repo.createEntry({
        id: "ent_1",
        project_id: "prj_1",
        start_time: "2026-02-26T09:00:00.000Z",
      });

      expect(repo.deleteProject("prj_1", {})).rejects.toBeInstanceOf(ProjectHasEntriesError);
    });

    it("force-deletes project and unassigns entries", async () => {
      await repo.createProject({ id: "prj_1", name: "Force" });
      await repo.createEntry({
        id: "ent_1",
        project_id: "prj_1",
        start_time: "2026-02-26T09:00:00.000Z",
      });

      const deleted = await repo.deleteProject("prj_1", { force: true });
      expect(deleted.name).toBe("Force");

      // Entry should still exist but unassigned
      const entry = await repo.getEntry("ent_1");
      expect(entry).not.toBeNull();
      expect(entry!.project_id).toBeNull();
    });

    it("throws ProjectNotFoundError for nonexistent project", async () => {
      expect(repo.deleteProject("prj_nope", {})).rejects.toBeInstanceOf(ProjectNotFoundError);
    });
  });

  describe("listProjects", () => {
    it("lists non-archived projects by default", async () => {
      await repo.createProject({ id: "prj_1", name: "Active" });
      await repo.createProject({ id: "prj_2", name: "Archived" });
      await repo.updateProject("prj_2", { archived: true });

      const projects = await repo.listProjects({});
      expect(projects).toHaveLength(1);
      expect(projects[0]!.name).toBe("Active");
    });

    it("includes archived when requested", async () => {
      await repo.createProject({ id: "prj_1", name: "Active" });
      await repo.createProject({ id: "prj_2", name: "Archived" });
      await repo.updateProject("prj_2", { archived: true });

      const projects = await repo.listProjects({ include_archived: true });
      expect(projects).toHaveLength(2);
    });

    it("orders by name", async () => {
      await repo.createProject({ id: "prj_2", name: "Bravo" });
      await repo.createProject({ id: "prj_1", name: "Alpha" });
      const projects = await repo.listProjects({});
      expect(projects[0]!.name).toBe("Alpha");
      expect(projects[1]!.name).toBe("Bravo");
    });
  });
});

// ─── Reports ────────────────────────────────────────────────────

describe("getEntriesForReport", () => {
  it("returns entries matching filters", async () => {
    await repo.createProject({ id: "prj_1", name: "Acme" });
    await repo.createEntry({
      id: "ent_1",
      project_id: "prj_1",
      start_time: "2026-02-25T09:00:00.000Z",
      end_time: "2026-02-25T10:00:00.000Z",
      tags: ["backend"],
    });
    await repo.createEntry({
      id: "ent_2",
      project_id: "prj_1",
      start_time: "2026-02-26T09:00:00.000Z",
      end_time: "2026-02-26T11:00:00.000Z",
      tags: ["frontend"],
    });

    const result = await repo.getEntriesForReport({
      project_id: "prj_1",
      from: "2026-02-26T00:00:00.000Z",
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("ent_2");
  });

  it("filters by tags", async () => {
    await repo.createEntry({
      id: "ent_1",
      start_time: "2026-02-26T09:00:00.000Z",
      end_time: "2026-02-26T10:00:00.000Z",
      tags: ["backend", "api"],
    });
    await repo.createEntry({
      id: "ent_2",
      start_time: "2026-02-26T11:00:00.000Z",
      end_time: "2026-02-26T12:00:00.000Z",
      tags: ["frontend"],
    });

    const result = await repo.getEntriesForReport({ tags: ["backend"] });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("ent_1");
  });

  it("orders by start_time ascending", async () => {
    await repo.createEntry({
      id: "ent_2",
      start_time: "2026-02-26T11:00:00.000Z",
      end_time: "2026-02-26T12:00:00.000Z",
    });
    await repo.createEntry({
      id: "ent_1",
      start_time: "2026-02-26T09:00:00.000Z",
      end_time: "2026-02-26T10:00:00.000Z",
    });

    const result = await repo.getEntriesForReport({});
    expect(result[0]!.id).toBe("ent_1");
    expect(result[1]!.id).toBe("ent_2");
  });
});
