import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "@/data/schema.ts";

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

describe("schema", () => {
  describe("projects table", () => {
    it("inserts and selects a project", () => {
      const db = createTestDb();
      db.insert(schema.projects)
        .values({
          id: "prj_test1",
          name: "Acme",
          client: "Acme Corp",
          color: "#ff0000",
          rate: 150,
          currency: "USD",
        })
        .run();

      const rows = db.select().from(schema.projects).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe("prj_test1");
      expect(rows[0]!.name).toBe("Acme");
      expect(rows[0]!.client).toBe("Acme Corp");
      expect(rows[0]!.rate).toBe(150);
      expect(rows[0]!.currency).toBe("USD");
      expect(rows[0]!.archived).toBe(0);
      expect(rows[0]!.created_at).toBeTruthy();
      expect(rows[0]!.updated_at).toBeTruthy();
    });

    it("enforces unique name constraint", () => {
      const db = createTestDb();
      db.insert(schema.projects).values({ id: "prj_1", name: "Acme" }).run();
      expect(() =>
        db.insert(schema.projects).values({ id: "prj_2", name: "Acme" }).run(),
      ).toThrow();
    });

    it("defaults currency to USD", () => {
      const db = createTestDb();
      db.insert(schema.projects).values({ id: "prj_1", name: "Test" }).run();
      const row = db.select().from(schema.projects).get();
      expect(row!.currency).toBe("USD");
    });
  });

  describe("entries table", () => {
    it("inserts and selects an entry", () => {
      const db = createTestDb();
      db.insert(schema.entries)
        .values({
          id: "ent_test1",
          description: "Working on stuff",
          start_time: "2026-02-26T09:00:00.000Z",
          end_time: "2026-02-26T10:30:00.000Z",
          tags: '["backend","urgent"]',
          billable: 1,
        })
        .run();

      const rows = db.select().from(schema.entries).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe("ent_test1");
      expect(rows[0]!.description).toBe("Working on stuff");
      expect(rows[0]!.tags).toBe('["backend","urgent"]');
      expect(rows[0]!.billable).toBe(1);
      expect(rows[0]!.end_time).toBe("2026-02-26T10:30:00.000Z");
    });

    it("allows null end_time for running timers", () => {
      const db = createTestDb();
      db.insert(schema.entries)
        .values({ id: "ent_running", start_time: "2026-02-26T09:00:00.000Z" })
        .run();
      const row = db.select().from(schema.entries).get();
      expect(row!.end_time).toBeNull();
    });

    it("defaults description to empty string", () => {
      const db = createTestDb();
      db.insert(schema.entries)
        .values({ id: "ent_1", start_time: "2026-02-26T09:00:00.000Z" })
        .run();
      const row = db.select().from(schema.entries).get();
      expect(row!.description).toBe("");
    });

    it("defaults tags to empty JSON array", () => {
      const db = createTestDb();
      db.insert(schema.entries)
        .values({ id: "ent_1", start_time: "2026-02-26T09:00:00.000Z" })
        .run();
      const row = db.select().from(schema.entries).get();
      expect(row!.tags).toBe("[]");
    });
  });

  describe("foreign keys", () => {
    it("links entry to project", () => {
      const db = createTestDb();
      db.insert(schema.projects).values({ id: "prj_1", name: "Acme" }).run();
      db.insert(schema.entries)
        .values({
          id: "ent_1",
          project_id: "prj_1",
          start_time: "2026-02-26T09:00:00.000Z",
        })
        .run();
      const row = db.select().from(schema.entries).get();
      expect(row!.project_id).toBe("prj_1");
    });

    it("sets project_id to null on project deletion (ON DELETE SET NULL)", () => {
      const db = createTestDb();
      db.insert(schema.projects).values({ id: "prj_1", name: "Acme" }).run();
      db.insert(schema.entries)
        .values({
          id: "ent_1",
          project_id: "prj_1",
          start_time: "2026-02-26T09:00:00.000Z",
        })
        .run();

      db.delete(schema.projects).where(eq(schema.projects.id, "prj_1")).run();

      const row = db.select().from(schema.entries).get();
      expect(row!.project_id).toBeNull();
    });
  });
});
