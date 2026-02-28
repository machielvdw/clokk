import type { Database } from "bun:sqlite";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { EntryNotFoundError, ProjectHasEntriesError, ProjectNotFoundError } from "@/core/errors.ts";
import type {
  Entry,
  EntryFilters,
  EntryUpdates,
  NewEntry,
  NewProject,
  Project,
  ProjectFilters,
  ProjectUpdates,
  ReportFilters,
} from "@/core/types.ts";
import { buildEntryConditions, nowISO, toEntry, toProject } from "@/data/mappers.ts";
import type { Repository } from "@/data/repository.ts";
import * as schema from "@/data/schema.ts";
import { entries, projects } from "@/data/schema.ts";
import { isProjectId } from "@/utils/id.ts";

export class SqliteRepository implements Repository {
  private db: BunSQLiteDatabase<typeof schema>;

  constructor(sqlite: Database) {
    this.db = drizzle(sqlite, { schema });
  }

  // ─── Entries ──────────────────────────────────────────────────

  async createEntry(entry: NewEntry): Promise<Entry> {
    const row = {
      id: entry.id,
      project_id: entry.project_id ?? null,
      description: entry.description ?? "",
      start_time: entry.start_time,
      end_time: entry.end_time ?? null,
      tags: JSON.stringify(entry.tags ?? []),
      billable: entry.billable === false ? 0 : 1,
    };
    this.db.insert(entries).values(row).run();
    return this.getEntryOrThrow(entry.id);
  }

  async getEntry(id: string): Promise<Entry | null> {
    const row = this.db.select().from(entries).where(eq(entries.id, id)).get();
    return row ? toEntry(row) : null;
  }

  async updateEntry(id: string, updates: EntryUpdates): Promise<Entry> {
    const existing = this.db.select().from(entries).where(eq(entries.id, id)).get();
    if (!existing) throw new EntryNotFoundError(id);

    const values: Record<string, unknown> = { updated_at: nowISO() };
    if (updates.description !== undefined) values.description = updates.description;
    if (updates.project_id !== undefined) values.project_id = updates.project_id;
    if (updates.start_time !== undefined) values.start_time = updates.start_time;
    if (updates.end_time !== undefined) values.end_time = updates.end_time;
    if (updates.tags !== undefined) values.tags = JSON.stringify(updates.tags);
    if (updates.billable !== undefined) values.billable = updates.billable ? 1 : 0;

    this.db.update(entries).set(values).where(eq(entries.id, id)).run();
    return this.getEntryOrThrow(id);
  }

  async deleteEntry(id: string): Promise<Entry> {
    const existing = this.db.select().from(entries).where(eq(entries.id, id)).get();
    if (!existing) throw new EntryNotFoundError(id);

    const entry = toEntry(existing);
    this.db.delete(entries).where(eq(entries.id, id)).run();
    return entry;
  }

  async listEntries(filters: EntryFilters): Promise<{ entries: Entry[]; total: number }> {
    const conditions = buildEntryConditions(filters);
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const rows = this.db
      .select()
      .from(entries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(entries.start_time))
      .limit(limit)
      .offset(offset)
      .all();

    const totalResult = this.db
      .select({ count: count() })
      .from(entries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .get();

    return {
      entries: rows.map(toEntry),
      total: totalResult?.count ?? 0,
    };
  }

  async getRunningEntry(): Promise<Entry | null> {
    const row = this.db.select().from(entries).where(isNull(entries.end_time)).get();
    return row ? toEntry(row) : null;
  }

  // ─── Projects ─────────────────────────────────────────────────

  async createProject(project: NewProject): Promise<Project> {
    const row = {
      id: project.id,
      name: project.name,
      client: project.client ?? null,
      color: project.color ?? null,
      rate: project.rate ?? null,
      currency: project.currency ?? "USD",
    };
    this.db.insert(projects).values(row).run();
    return this.getProjectOrThrow(project.id);
  }

  async getProject(idOrName: string): Promise<Project | null> {
    const condition = isProjectId(idOrName)
      ? eq(projects.id, idOrName)
      : eq(projects.name, idOrName);

    const row = this.db.select().from(projects).where(condition).get();
    return row ? toProject(row) : null;
  }

  async updateProject(id: string, updates: ProjectUpdates): Promise<Project> {
    const existing = this.db.select().from(projects).where(eq(projects.id, id)).get();
    if (!existing) throw new ProjectNotFoundError(id);

    const values: Record<string, unknown> = { updated_at: nowISO() };
    if (updates.name !== undefined) values.name = updates.name;
    if (updates.client !== undefined) values.client = updates.client;
    if (updates.color !== undefined) values.color = updates.color;
    if (updates.rate !== undefined) values.rate = updates.rate;
    if (updates.currency !== undefined) values.currency = updates.currency;
    if (updates.archived !== undefined) values.archived = updates.archived ? 1 : 0;

    this.db.update(projects).set(values).where(eq(projects.id, id)).run();
    return this.getProjectOrThrow(id);
  }

  async deleteProject(id: string, opts: { force?: boolean } = {}): Promise<Project> {
    const existing = this.db.select().from(projects).where(eq(projects.id, id)).get();
    if (!existing) throw new ProjectNotFoundError(id);

    const project = toProject(existing);

    // Check for referencing entries
    const entryCountResult = this.db
      .select({ count: count() })
      .from(entries)
      .where(eq(entries.project_id, id))
      .get();
    const entryCount = entryCountResult?.count ?? 0;

    if (entryCount > 0 && !opts.force) {
      throw new ProjectHasEntriesError(id, entryCount);
    }

    if (entryCount > 0 && opts.force) {
      // Unassign entries before deleting
      this.db
        .update(entries)
        .set({ project_id: null, updated_at: nowISO() })
        .where(eq(entries.project_id, id))
        .run();
    }

    this.db.delete(projects).where(eq(projects.id, id)).run();
    return project;
  }

  async listProjects(filters: ProjectFilters = {}): Promise<Project[]> {
    const condition = filters.include_archived ? undefined : eq(projects.archived, 0);

    const rows = this.db.select().from(projects).where(condition).orderBy(projects.name).all();

    return rows.map(toProject);
  }

  // ─── Reports ──────────────────────────────────────────────────

  async getEntriesForReport(filters: ReportFilters): Promise<Entry[]> {
    const conditions = buildEntryConditions(filters);

    const rows = this.db
      .select()
      .from(entries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(entries.start_time)
      .all();

    return rows.map(toEntry);
  }

  // ─── Private helpers ──────────────────────────────────────────

  private async getEntryOrThrow(id: string): Promise<Entry> {
    const entry = await this.getEntry(id);
    if (!entry) throw new EntryNotFoundError(id);
    return entry;
  }

  private async getProjectOrThrow(id: string): Promise<Project> {
    const project = await this.getProject(id);
    if (!project) throw new ProjectNotFoundError(id);
    return project;
  }
}
