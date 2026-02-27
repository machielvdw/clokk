import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { and, eq, gte, isNull, like, lte, sql } from "drizzle-orm";

import type { Entry, EntryFilters, Project, ReportFilters } from "@/core/types.ts";
import { entries } from "@/data/schema.ts";

dayjs.extend(utc);

// ─── Row types (inferred from Drizzle schema, shared across backends) ──

export type EntryRow = typeof entries.$inferSelect;

// Import projects here just for the type inference
import { projects } from "@/data/schema.ts";
export type ProjectRow = typeof projects.$inferSelect;

// ─── Mappers ────────────────────────────────────────────────────────────

export function toEntry(row: EntryRow): Entry {
  let durationSeconds: number | null = null;
  if (row.end_time && row.start_time) {
    durationSeconds = dayjs
      .utc(row.end_time)
      .diff(dayjs.utc(row.start_time), "second");
  }
  return {
    id: row.id,
    project_id: row.project_id,
    description: row.description,
    start_time: row.start_time,
    end_time: row.end_time,
    tags: JSON.parse(row.tags) as string[],
    billable: row.billable === 1,
    duration_seconds: durationSeconds,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    client: row.client,
    color: row.color,
    rate: row.rate,
    currency: row.currency,
    archived: row.archived === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────

export function nowISO(): string {
  return new Date().toISOString();
}

export function buildEntryConditions(filters: EntryFilters | ReportFilters) {
  const conditions: ReturnType<typeof eq>[] = [];

  if (filters.project_id) {
    conditions.push(eq(entries.project_id, filters.project_id));
  }
  if (filters.from) {
    conditions.push(gte(entries.start_time, filters.from));
  }
  if (filters.to) {
    conditions.push(lte(entries.start_time, filters.to));
  }
  if (filters.billable !== undefined) {
    conditions.push(eq(entries.billable, filters.billable ? 1 : 0));
  }
  if (filters.tags && filters.tags.length > 0) {
    for (const tag of filters.tags) {
      conditions.push(like(entries.tags, `%"${tag}"%`));
    }
  }

  // EntryFilters has `running`; ReportFilters does not
  if ("running" in filters) {
    const ef = filters as EntryFilters;
    if (ef.running === true) {
      conditions.push(isNull(entries.end_time));
    }
    if (ef.running === false) {
      conditions.push(sql`${entries.end_time} IS NOT NULL`);
    }
  }

  return conditions;
}
