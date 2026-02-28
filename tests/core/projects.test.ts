import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import {
  ProjectAlreadyExistsError,
  ProjectHasEntriesError,
  ProjectNotFoundError,
} from "@/core/errors.ts";
import {
  archiveProject,
  createProject,
  deleteProject,
  editProject,
  listProjects,
} from "@/core/projects.ts";
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

// ─── createProject ──────────────────────────────────────────────

describe("createProject", () => {
  it("creates a project with generated ID", async () => {
    const project = await createProject(repo, { name: "Acme" });
    expect(project.id).toStartWith("prj_");
    expect(project.name).toBe("Acme");
    expect(project.archived).toBe(false);
  });

  it("sets optional fields", async () => {
    const project = await createProject(repo, {
      name: "Acme",
      client: "Acme Corp",
      rate: 150,
      currency: "EUR",
      color: "#ff0000",
    });
    expect(project.client).toBe("Acme Corp");
    expect(project.rate).toBe(150);
    expect(project.currency).toBe("EUR");
    expect(project.color).toBe("#ff0000");
  });

  it("throws ProjectAlreadyExistsError for duplicate name", async () => {
    await createProject(repo, { name: "Acme" });
    expect(createProject(repo, { name: "Acme" })).rejects.toBeInstanceOf(ProjectAlreadyExistsError);
  });
});

// ─── editProject ────────────────────────────────────────────────

describe("editProject", () => {
  it("updates project fields by name", async () => {
    await createProject(repo, { name: "Acme" });
    const updated = await editProject(repo, "Acme", {
      client: "New Client",
      rate: 200,
    });
    expect(updated.client).toBe("New Client");
    expect(updated.rate).toBe(200);
  });

  it("updates project fields by ID", async () => {
    const project = await createProject(repo, { name: "Acme" });
    const updated = await editProject(repo, project.id, {
      currency: "GBP",
    });
    expect(updated.currency).toBe("GBP");
  });

  it("renames a project", async () => {
    await createProject(repo, { name: "Old Name" });
    const updated = await editProject(repo, "Old Name", {
      name: "New Name",
    });
    expect(updated.name).toBe("New Name");
  });

  it("throws ProjectAlreadyExistsError when renaming to existing name", async () => {
    await createProject(repo, { name: "Acme" });
    await createProject(repo, { name: "Beta" });
    expect(editProject(repo, "Acme", { name: "Beta" })).rejects.toBeInstanceOf(
      ProjectAlreadyExistsError,
    );
  });

  it("allows renaming to the same name (no-op)", async () => {
    await createProject(repo, { name: "Acme" });
    const updated = await editProject(repo, "Acme", { name: "Acme" });
    expect(updated.name).toBe("Acme");
  });

  it("throws ProjectNotFoundError for nonexistent project", async () => {
    expect(editProject(repo, "nonexistent", { client: "New" })).rejects.toBeInstanceOf(
      ProjectNotFoundError,
    );
  });
});

// ─── archiveProject ─────────────────────────────────────────────

describe("archiveProject", () => {
  it("sets archived to true", async () => {
    await createProject(repo, { name: "Acme" });
    const archived = await archiveProject(repo, "Acme");
    expect(archived.archived).toBe(true);
  });

  it("works by ID", async () => {
    const project = await createProject(repo, { name: "Acme" });
    const archived = await archiveProject(repo, project.id);
    expect(archived.archived).toBe(true);
  });

  it("throws ProjectNotFoundError for nonexistent project", async () => {
    expect(archiveProject(repo, "nonexistent")).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});

// ─── deleteProject ──────────────────────────────────────────────

describe("deleteProject", () => {
  it("deletes a project with no entries", async () => {
    await createProject(repo, { name: "Acme" });
    const deleted = await deleteProject(repo, "Acme");
    expect(deleted.name).toBe("Acme");

    const list = await listProjects(repo);
    expect(list).toHaveLength(0);
  });

  it("throws ProjectHasEntriesError when entries exist and no force", async () => {
    const project = await createProject(repo, { name: "Acme" });
    await repo.createEntry({
      id: "ent_1",
      project_id: project.id,
      start_time: "2026-02-26T09:00:00.000Z",
      end_time: "2026-02-26T10:00:00.000Z",
    });
    expect(deleteProject(repo, "Acme")).rejects.toBeInstanceOf(ProjectHasEntriesError);
  });

  it("force deletes and unassigns entries", async () => {
    const project = await createProject(repo, { name: "Acme" });
    await repo.createEntry({
      id: "ent_1",
      project_id: project.id,
      start_time: "2026-02-26T09:00:00.000Z",
      end_time: "2026-02-26T10:00:00.000Z",
    });
    await deleteProject(repo, "Acme", { force: true });

    const entry = await repo.getEntry("ent_1");
    expect(entry!.project_id).toBeNull();
  });

  it("throws ProjectNotFoundError for nonexistent project", async () => {
    expect(deleteProject(repo, "nonexistent")).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});

// ─── listProjects ───────────────────────────────────────────────

describe("listProjects", () => {
  it("lists non-archived projects by default", async () => {
    await createProject(repo, { name: "Active" });
    const archived = await createProject(repo, { name: "Archived" });
    await archiveProject(repo, archived.id);

    const list = await listProjects(repo);
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe("Active");
  });

  it("includes archived projects when requested", async () => {
    await createProject(repo, { name: "Active" });
    const archived = await createProject(repo, { name: "Archived" });
    await archiveProject(repo, archived.id);

    const list = await listProjects(repo, { include_archived: true });
    expect(list).toHaveLength(2);
  });

  it("returns empty array when no projects", async () => {
    const list = await listProjects(repo);
    expect(list).toHaveLength(0);
  });
});
