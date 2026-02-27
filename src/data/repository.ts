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

/**
 * Repository interface — the contract between core and data layers.
 *
 * All methods are async to support both synchronous (bun:sqlite) and
 * asynchronous (Turso/libsql) backends without changing the contract.
 *
 * All mutations return the affected object so the core layer can
 * return it to the interface layer without an extra read.
 */
export interface Repository {
  // ─── Entries ──────────────────────────────────────────────────

  /** Create a new time entry. */
  createEntry(entry: NewEntry): Promise<Entry>;

  /** Get an entry by ID. Returns null if not found. */
  getEntry(id: string): Promise<Entry | null>;

  /** Update an entry. Returns the updated entry. */
  updateEntry(id: string, updates: EntryUpdates): Promise<Entry>;

  /** Delete an entry. Returns the deleted entry. */
  deleteEntry(id: string): Promise<Entry>;

  /** List entries with optional filters and pagination. */
  listEntries(filters: EntryFilters): Promise<{ entries: Entry[]; total: number }>;

  /** Get the currently running entry (end_time IS NULL). Returns null if none. */
  getRunningEntry(): Promise<Entry | null>;

  // ─── Projects ─────────────────────────────────────────────────

  /** Create a new project. */
  createProject(project: NewProject): Promise<Project>;

  /**
   * Get a project by ID or name.
   * Resolves which one was passed by checking for the "prj_" prefix.
   */
  getProject(idOrName: string): Promise<Project | null>;

  /** Update a project. Returns the updated project. */
  updateProject(id: string, updates: ProjectUpdates): Promise<Project>;

  /**
   * Delete a project.
   * Without force: throws ProjectHasEntriesError if entries reference it.
   * With force: entries become unassigned (project_id set to null).
   */
  deleteProject(id: string, opts: { force?: boolean }): Promise<Project>;

  /** List projects with optional filters. */
  listProjects(filters: ProjectFilters): Promise<Project[]>;

  // ─── Reports ──────────────────────────────────────────────────

  /** Get entries matching report filters (no pagination, returns all matches). */
  getEntriesForReport(filters: ReportFilters): Promise<Entry[]>;
}

// ─── Sync ──────────────────────────────────────────────────────

/** Result of a manual sync operation. */
export interface SyncResult {
  synced: boolean;
  message: string;
}

/**
 * A repository that supports cloud sync via Turso embedded replicas.
 * Only TursoRepository implements this interface.
 */
export interface SyncableRepository extends Repository {
  /** Trigger a manual sync with the remote database. */
  sync(): Promise<SyncResult>;
}

/** Type guard: check if a Repository supports sync. */
export function isSyncableRepository(
  repo: Repository,
): repo is SyncableRepository {
  return "sync" in repo && typeof (repo as SyncableRepository).sync === "function";
}
