import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import type { ClokkConfig } from "@/config.ts";
import { getDbPath } from "@/config.ts";
import type { Repository } from "@/data/repository.ts";
import * as schema from "@/data/schema.ts";
import { SqliteRepository } from "@/data/sqlite.ts";

export async function createRepository(config: ClokkConfig): Promise<Repository> {
  if (config.turso.url && config.turso.token) {
    return createTursoRepository(config);
  }

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

async function createTursoRepository(config: ClokkConfig): Promise<Repository> {
  const { createClient } = await import("@libsql/client");
  const { drizzle: drizzleLibsql } = await import("drizzle-orm/libsql");
  const { migrate: migrateLibsql } = await import("drizzle-orm/libsql/migrator");
  const { TursoRepository } = await import("@/data/turso.ts");

  const dbPath = getDbPath();
  const client = createClient({
    url: `file:${dbPath}`,
    syncUrl: config.turso.url!,
    authToken: config.turso.token!,
    syncInterval: 60,
  });

  // Set pragmas for performance
  await client.execute("PRAGMA journal_mode = WAL");
  await client.execute("PRAGMA synchronous = NORMAL");
  await client.execute("PRAGMA foreign_keys = ON");

  // Run migrations
  const db = drizzleLibsql(client, { schema });
  await migrateLibsql(db, { migrationsFolder: "./drizzle" });

  return new TursoRepository(client);
}
