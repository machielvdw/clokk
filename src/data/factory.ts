import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import type { Repository } from "@/data/repository.ts";
import { SqliteRepository } from "@/data/sqlite.ts";
import * as schema from "@/data/schema.ts";
import type { ClokkConfig } from "@/config.ts";
import { getDbPath } from "@/config.ts";

export function createRepository(config: ClokkConfig): Repository {
  const dbPath = getDbPath();
  const sqlite = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  sqlite.run("PRAGMA journal_mode = WAL");

  // Enable foreign key enforcement (off by default in SQLite)
  sqlite.run("PRAGMA foreign_keys = ON");

  // Run migrations
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });

  return new SqliteRepository(sqlite);
}
