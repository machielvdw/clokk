import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    client: text("client"),
    color: text("color"),
    rate: real("rate"),
    currency: text("currency").default("USD").notNull(),
    archived: integer("archived").default(0).notNull(),
    created_at: text("created_at").default(sql`(datetime('now'))`).notNull(),
    updated_at: text("updated_at").default(sql`(datetime('now'))`).notNull(),
  },
  (table) => [uniqueIndex("idx_projects_name").on(table.name)],
);

export const entries = sqliteTable(
  "entries",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    description: text("description").default("").notNull(),
    start_time: text("start_time").notNull(),
    end_time: text("end_time"),
    tags: text("tags").default("[]").notNull(),
    billable: integer("billable").default(1).notNull(),
    created_at: text("created_at").default(sql`(datetime('now'))`).notNull(),
    updated_at: text("updated_at").default(sql`(datetime('now'))`).notNull(),
  },
  (table) => [
    index("idx_entries_start").on(table.start_time),
    index("idx_entries_project").on(table.project_id),
    index("idx_entries_end").on(table.end_time),
  ],
);
