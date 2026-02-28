import { beforeEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "@/data/schema.ts";
import { SqliteRepository } from "@/data/sqlite.ts";
import type { Repository } from "@/data/repository.ts";
import { handleToolCall, resolveProjectId } from "@/mcp/handle.ts";
import {
  NoTimerRunningError,
  ValidationError,
} from "@/core/errors.ts";
import { createProject } from "@/core/projects.ts";

function createRepo(): Repository {
  const sqlite = new Database(":memory:");
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  return new SqliteRepository(sqlite);
}

describe("handleToolCall", () => {
  it("returns JSON content on success", async () => {
    const result = await handleToolCall(async () => ({
      id: "ent_123",
      running: true,
    }));
    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.id).toBe("ent_123");
    expect(parsed.running).toBe(true);
  });

  it("returns structured error for ClokkError", async () => {
    const result = await handleToolCall(async () => {
      throw new NoTimerRunningError();
    });
    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.error).toBe("NO_TIMER_RUNNING");
    expect(parsed.message).toBeDefined();
    expect(Array.isArray(parsed.suggestions)).toBe(true);
  });

  it("includes suggestions from ClokkError", async () => {
    const result = await handleToolCall(async () => {
      throw new ValidationError("bad input", { field: "from" });
    });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.error).toBe("VALIDATION_ERROR");
  });

  it("re-throws unknown errors", async () => {
    await expect(
      handleToolCall(async () => {
        throw new Error("unexpected");
      }),
    ).rejects.toThrow("unexpected");
  });
});

describe("resolveProjectId", () => {
  let repo: Repository;

  beforeEach(() => {
    repo = createRepo();
  });

  it("resolves a project name to its ID", async () => {
    const project = await createProject(repo, { name: "acme" });
    const resolved = await resolveProjectId(repo, "acme");
    expect(resolved).toBe(project.id);
  });

  it("resolves a project ID to itself", async () => {
    const project = await createProject(repo, { name: "acme" });
    const resolved = await resolveProjectId(repo, project.id);
    expect(resolved).toBe(project.id);
  });

  it("passes through unknown input", async () => {
    const resolved = await resolveProjectId(repo, "nonexistent");
    expect(resolved).toBe("nonexistent");
  });
});
