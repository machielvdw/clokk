// ─── Entity types (returned by repository and core) ───────────────────

export interface Entry {
  id: string;
  project_id: string | null;
  description: string;
  start_time: string; // ISO 8601 UTC
  end_time: string | null; // null = timer is running
  tags: string[];
  billable: boolean;
  duration_seconds: number | null; // computed from end_time - start_time, null if running
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  client: string | null;
  color: string | null;
  rate: number | null;
  currency: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Input types (for creating/updating) ──────────────────────────────

export interface NewEntry {
  id: string;
  project_id?: string | null;
  description?: string;
  start_time: string;
  end_time?: string | null;
  tags?: string[];
  billable?: boolean;
}

export interface EntryUpdates {
  description?: string;
  project_id?: string | null;
  start_time?: string;
  end_time?: string | null;
  tags?: string[];
  billable?: boolean;
}

export interface NewProject {
  id: string;
  name: string;
  client?: string | null;
  color?: string | null;
  rate?: number | null;
  currency?: string;
}

export interface ProjectUpdates {
  name?: string;
  client?: string | null;
  color?: string | null;
  rate?: number | null;
  currency?: string;
  archived?: boolean;
}

// ─── Filter types (for queries) ───────────────────────────────────────

export interface EntryFilters {
  project_id?: string;
  tags?: string[];
  from?: string; // ISO 8601 UTC
  to?: string; // ISO 8601 UTC
  billable?: boolean;
  running?: boolean;
  limit?: number;
  offset?: number;
}

export interface ProjectFilters {
  include_archived?: boolean;
}

export interface ReportFilters {
  project_id?: string;
  tags?: string[];
  from?: string;
  to?: string;
  billable?: boolean;
  group_by?: "project" | "tag" | "day" | "week";
}

export interface ExportFilters {
  project_id?: string;
  from?: string;
  to?: string;
  format?: "csv" | "json";
}

// ─── Core function input types ────────────────────────────────────────

export interface StartTimerInput {
  description?: string;
  project?: string; // name or ID, resolved by core
  tags?: string[];
  billable?: boolean;
  at?: string; // override start time, ISO 8601 UTC
}

export interface StopTimerInput {
  at?: string; // override stop time
  description?: string; // update description on stop
  tags?: string[]; // update tags on stop
}

export interface ResumeTimerInput {
  id?: string; // resume a specific entry instead of most recent
}

export interface SwitchTimerInput {
  description: string;
  project?: string;
  tags?: string[];
}

export interface LogEntryInput {
  description?: string;
  project?: string;
  from: string; // ISO 8601 UTC
  to?: string; // ISO 8601 UTC, mutually exclusive with duration
  duration?: number; // seconds, mutually exclusive with to
  tags?: string[];
  billable?: boolean;
}

// ─── Result types ─────────────────────────────────────────────────────

export interface StatusResult {
  running: boolean;
  entry?: Entry;
  elapsed_seconds?: number;
}

export interface SwitchResult {
  stopped: Entry;
  started: Entry;
}

export interface ListEntriesResult {
  entries: Entry[];
  total: number;
  limit: number;
  offset: number;
}

export interface ReportGroup {
  key: string;
  total_seconds: number;
  billable_seconds: number;
  billable_amount: number | null;
  currency: string | null;
  entry_count: number;
  entries: Entry[];
}

export interface ReportResult {
  period: { from: string; to: string };
  total_seconds: number;
  billable_seconds: number;
  groups: ReportGroup[];
}

export interface ExportResult {
  data: string;
  format: "csv" | "json";
  entry_count: number;
}
