import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDefaultConfig } from "@/config.ts";
import { createRepository } from "@/data/factory.ts";

const TEST_DIR = join(tmpdir(), `clokk-factory-test-${Date.now()}`);

afterEach(() => {
  delete process.env.CLOKK_DIR;
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
});

describe("createRepository", () => {
  it("returns a working repository", async () => {
    process.env.CLOKK_DIR = TEST_DIR;
    mkdirSync(TEST_DIR, { recursive: true });

    const config = getDefaultConfig();
    const repo = await createRepository(config);

    // Verify it works by creating and reading a project
    const project = await repo.createProject({
      id: "prj_test",
      name: "Test Project",
    });
    expect(project.id).toBe("prj_test");
    expect(project.name).toBe("Test Project");

    const found = await repo.getProject("prj_test");
    expect(found).not.toBeNull();
    expect(found!.name).toBe("Test Project");
  });

  it("creates database file at expected path", async () => {
    process.env.CLOKK_DIR = TEST_DIR;
    mkdirSync(TEST_DIR, { recursive: true });

    const config = getDefaultConfig();
    await createRepository(config);

    expect(existsSync(join(TEST_DIR, "clokk.db"))).toBe(true);
  });

  it("enables foreign keys", async () => {
    process.env.CLOKK_DIR = TEST_DIR;
    mkdirSync(TEST_DIR, { recursive: true });

    const config = getDefaultConfig();
    const repo = await createRepository(config);

    // Create project + entry, delete project, entry.project_id should be null
    await repo.createProject({ id: "prj_1", name: "Test" });
    await repo.createEntry({
      id: "ent_1",
      project_id: "prj_1",
      start_time: "2026-02-26T09:00:00.000Z",
    });
    await repo.deleteProject("prj_1", { force: true });

    const entry = await repo.getEntry("ent_1");
    expect(entry!.project_id).toBeNull();
  });
});
