import { beforeEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { SqliteRepository } from "@/data/sqlite.ts";
import * as schema from "@/data/schema.ts";
import { triggerSync } from "@/core/sync.ts";
import { SyncNotConfiguredError } from "@/core/errors.ts";
import { isSyncableRepository } from "@/data/repository.ts";

function createSqliteRepo(): SqliteRepository {
  const sqlite = new Database(":memory:");
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  return new SqliteRepository(sqlite);
}

describe("triggerSync", () => {
  it("throws SyncNotConfiguredError for non-syncable repo", async () => {
    const repo = createSqliteRepo();
    expect(triggerSync(repo)).rejects.toBeInstanceOf(SyncNotConfiguredError);
  });

  it("throws with correct error code", async () => {
    const repo = createSqliteRepo();
    try {
      await triggerSync(repo);
    } catch (err) {
      expect((err as SyncNotConfiguredError).code).toBe("SYNC_NOT_CONFIGURED");
    }
  });
});

describe("isSyncableRepository", () => {
  it("returns false for SqliteRepository", () => {
    const repo = createSqliteRepo();
    expect(isSyncableRepository(repo)).toBe(false);
  });
});
