# clokk — Developer Specification

> A local-first CLI time tracker built for humans and AI agents.

---

## 1. Vision

clokk is a time tracking tool that works as a CLI today and can evolve into a TUI application with cloud-synced accounts tomorrow. It prioritizes two audiences equally:

- **Humans** who want a fast, pleasant terminal experience
- **AI agents** (like Claude Code) that need structured, predictable, self-documenting interfaces

Every design decision serves both audiences. If a feature is great for humans but opaque to agents, it ships with a machine-readable counterpart. If a feature is great for agents but ugly for humans, it gets a formatted layer on top.

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Bun | Native SQLite, fast startup, TS without build step, single-binary compile |
| CLI Framework | citty (UnJS) | Typed arg definitions, auto-generated help, lightweight |
| ORM | Drizzle | Type-safe schema, SQL-like query builder, supports both bun:sqlite and libsql adapters |
| Database (local) | bun:sqlite | Zero-dependency, instant reads/writes |
| Database (accounts) | Turso embedded replicas | Same SQLite dialect, local file + cloud sync, offline-first |
| Terminal Output | consola (UnJS) | Pluggable reporters (fancy ↔ JSON), environment auto-detection |
| Date Parsing | dayjs + custom relative parser | Lightweight, plugin-based, extensible with relative time parsing |
| Testing | bun test | Built-in, Jest-compatible |
| Distribution | `bun build --compile` | Single executable, no runtime dependency |
| TUI (future) | Ink | React for terminals, shares core layer with CLI |

### 2.1 Key Dependencies

These are the primary runtime dependencies. Versions should be pinned in `package.json` with exact versions (no `^` or `~`) to ensure reproducible builds.

| Package | Purpose |
|---|---|
| `citty` | CLI framework — command definition, arg parsing, help generation |
| `consola` | Terminal output — pluggable reporters, environment detection |
| `drizzle-orm` | ORM — type-safe schema, query builder |
| `drizzle-kit` | Dev dependency — migration generation and management |
| `dayjs` | Date parsing and formatting — lightweight alternative to moment |
| `nanoid` | ID generation — small, fast, URL-safe unique IDs |

Dev dependencies: `typescript`, `@types/bun`, `drizzle-kit`.

---

## 3. Architecture

clokk uses a three-layer architecture. The layers communicate through typed interfaces, never through formatted strings or CLI flags.

```
┌─────────────────────────────────────────────┐
│  Interface Layer (swappable)                │
│  ┌───────┐  ┌───────┐  ┌────────────────┐  │
│  │  CLI  │  │  TUI  │  │  API (future)  │  │
│  └───┬───┘  └───┬───┘  └───────┬────────┘  │
│      │          │               │           │
│  Parses args, formats output, handles I/O   │
├──────┴──────────┴───────────────┴───────────┤
│  Core Layer (business logic)                │
│                                             │
│  Pure functions. No I/O formatting.         │
│  Takes typed objects, returns typed objects. │
│  Throws typed errors.                       │
├─────────────────────────────────────────────┤
│  Data Layer (storage)                       │
│                                             │
│  Repository interface with two backends:    │
│  • SqliteRepository (bun:sqlite, local)     │
│  • TursoRepository (libsql, sync)           │
└─────────────────────────────────────────────┘
```

### 3.1 Core Layer Rules

- Every function takes a plain typed object and returns a plain typed object
- No awareness of CLI flags, output formatting, or TTY detection
- No direct imports of database drivers — only the repository interface
- Errors are thrown as typed error classes with machine-readable codes
- All timestamps are ISO 8601 UTC strings
- All durations are stored and returned as integer seconds
- `duration_seconds` is always **computed** from `end_time - start_time`, never stored. This avoids denormalization bugs when entries are edited.

### 3.2 Interface Layer Rules

- Thin wrapper: parse args → call core → format output
- Detects environment (TTY vs piped vs CI) to choose output format
- Never contains business logic
- Each command is a single file that maps 1:1 to a core function
- Responsible for parsing flexible date/duration input into normalized forms before passing to core

### 3.3 Data Layer Rules

- Accessed exclusively through a repository interface
- The active implementation is selected at startup based on config
- Schema is defined once in Drizzle and shared across both backends
- Migrations are managed by drizzle-kit

### 3.4 Repository Interface

The repository interface is the contract between the core layer and the data layer. Core functions never access the database directly — they call repository methods that return typed objects.

```ts
interface Repository {
  // Entries
  createEntry(entry: NewEntry): Promise<Entry>
  getEntry(id: string): Promise<Entry | null>
  updateEntry(id: string, updates: EntryUpdates): Promise<Entry>
  deleteEntry(id: string): Promise<Entry>
  listEntries(filters: EntryFilters): Promise<{ entries: Entry[]; total: number }>
  getRunningEntry(): Promise<Entry | null>

  // Projects
  createProject(project: NewProject): Promise<Project>
  getProject(idOrName: string): Promise<Project | null>
  updateProject(id: string, updates: ProjectUpdates): Promise<Project>
  deleteProject(id: string, opts: { force?: boolean }): Promise<Project>
  listProjects(filters: ProjectFilters): Promise<Project[]>

  // Reports
  getEntriesForReport(filters: ReportFilters): Promise<Entry[]>
}
```

**Design decisions:**

- **`getProject` accepts name or ID.** The repository resolves which one was passed (by checking the `prj_` prefix). This keeps the core layer free of "is this a name or ID?" logic.
- **`getRunningEntry` is its own method.** Finding `WHERE end_time IS NULL` is a frequent operation (called by `start`, `stop`, `switch`, `status`, `cancel`). A dedicated method makes the intent clear and allows the data layer to optimize with the `idx_entries_end` index.
- **`listEntries` returns `{ entries, total }`.** Total count is needed for pagination. The data layer runs the count query alongside the filtered query.
- **All mutations return the affected object.** This allows the core layer to return it to the interface layer without an extra read.
- **Methods are async.** Even though `bun:sqlite` is synchronous, the interface is async to support the Turso adapter (which uses network calls) without changing the contract.

### 3.5 Dependency Injection

The repository is injected into core functions, not imported as a global. This enables testing with in-memory databases and swapping backends at runtime.

```ts
// Core functions receive the repository as a parameter
function startTimer(repo: Repository, input: StartTimerInput): Promise<Entry>
function stopTimer(repo: Repository): Promise<Entry>

// The CLI layer creates the repository once and passes it through
const repo = createRepository(config)
const entry = await startTimer(repo, { description: "Bug triage", projectId: "prj_abc" })
```

A `createRepository(config)` factory function reads the config and returns the appropriate implementation (`SqliteRepository` or `TursoRepository`).

---

## 4. Project Structure

```
clokk/
├── src/
│   ├── core/                  # Business logic (the product)
│   │   ├── timer.ts           # start, stop, resume, switch, cancel, status
│   │   ├── entries.ts         # log, edit, delete, list
│   │   ├── projects.ts        # create, list, edit, archive, delete
│   │   ├── reports.ts         # summary, breakdown, export
│   │   ├── config.ts          # get, set, show
│   │   ├── errors.ts          # Typed error classes
│   │   └── types.ts           # Shared types (Entry, Project, filters, etc.)
│   │
│   ├── data/                  # Storage layer
│   │   ├── schema.ts          # Drizzle schema (single source of truth)
│   │   ├── repository.ts      # Interface definition
│   │   ├── sqlite.ts          # bun:sqlite implementation
│   │   ├── factory.ts         # createRepository() — selects backend from config
│   │   └── turso.ts           # libsql implementation (future)
│   │
│   ├── cli/                   # CLI interface
│   │   ├── index.ts           # Entry point, command router
│   │   ├── commands/          # One file per command
│   │   │   ├── start.ts
│   │   │   ├── stop.ts
│   │   │   ├── status.ts
│   │   │   ├── resume.ts
│   │   │   ├── switch.ts
│   │   │   ├── cancel.ts
│   │   │   ├── log.ts
│   │   │   ├── edit.ts
│   │   │   ├── delete.ts
│   │   │   ├── list.ts
│   │   │   ├── project.ts     # Subcommands: create, list, edit, archive, delete
│   │   │   ├── report.ts
│   │   │   ├── export.ts
│   │   │   ├── config.ts
│   │   │   ├── schema.ts      # Outputs full CLI schema as JSON for agents
│   │   │   └── commands.ts    # Lists all commands with brief descriptions
│   │   │
│   │   ├── output.ts          # TTY detection, format switching
│   │   ├── format.ts          # Human-friendly formatters (durations, tables, colors)
│   │   └── parse.ts           # Input parsing (dates, durations, tags)
│   │
│   └── tui/                   # TUI interface (future)
│
├── drizzle/                   # Migration files (generated by drizzle-kit)
├── drizzle.config.ts          # Drizzle Kit configuration
├── tests/
│   ├── core/                  # Unit tests for core layer
│   ├── data/                  # Integration tests for data layer
│   ├── cli/                   # CLI integration tests (spawn process, assert JSON)
│   └── workflows/             # End-to-end agent workflow simulations
├── package.json
├── tsconfig.json
└── .gitignore
```

### Drizzle Configuration

```ts
// drizzle.config.ts
import type { Config } from "drizzle-kit"

export default {
  schema: "./src/data/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.CLOKK_DB ?? "~/.clokk/clokk.db",
  },
} satisfies Config
```

---

## 5. Output Contract

Every command produces output conforming to one of two formats, selected automatically.

### 5.1 Format Selection

| Condition | Format |
|---|---|
| stdout is a TTY | Human (colored, tables, icons) |
| stdout is piped / redirected | JSON |
| `--json` flag is passed | JSON (overrides TTY) |
| `--human` flag is passed | Human (overrides pipe) |
| `CLOKK_OUTPUT=json` env var | JSON (overrides TTY) |
| `NO_COLOR` env var is set | Human without colors |

AI agents running clokk through a shell will typically receive JSON automatically because stdout is piped. The `--json` flag exists as an explicit override.

### 5.2 JSON Envelope

Every JSON response uses the same envelope:

**Success:**
```json
{
  "ok": true,
  "data": { },
  "message": "Timer started: API integration [acme]"
}
```

**Error:**
```json
{
  "ok": false,
  "error": {
    "code": "TIMER_ALREADY_RUNNING",
    "message": "A timer is already running: \"Bug triage\" (ent_k8f2x). Stop it first with 'clokk stop' or use 'clokk switch' to stop and start in one command.",
    "suggestions": ["clokk stop", "clokk switch \"API integration\""],
    "context": {
      "running_entry_id": "ent_k8f2x",
      "running_description": "Bug triage"
    }
  }
}
```

### 5.3 Envelope Rules

- `ok` is always present and always a boolean
- `data` is always present on success, always absent on error
- `error` is always present on error, always absent on success
- `error.code` is always UPPER_SNAKE_CASE and stable (agents can match on it)
- `error.message` is always a full sentence with actionable guidance
- `error.suggestions` is an optional array of exact commands the user/agent can run to fix the issue
- `error.context` is an optional object with relevant IDs and values
- `message` on success is a human-readable summary; agents should use `data`
- `data` always includes the `id` of any created or modified resource

### 5.4 Error Codes

Error codes are stable and part of the public API. Removing or renaming a code is a breaking change.

| Code | When |
|---|---|
| `TIMER_ALREADY_RUNNING` | `start` called while a timer is active |
| `NO_TIMER_RUNNING` | `stop`, `resume`, `cancel` called with no active timer |
| `ENTRY_NOT_FOUND` | Referenced entry ID doesn't exist |
| `PROJECT_NOT_FOUND` | Referenced project name or ID doesn't exist |
| `PROJECT_ALREADY_EXISTS` | `project create` with a name that's taken |
| `PROJECT_HAS_ENTRIES` | `project delete` without `--force` when entries reference it |
| `VALIDATION_ERROR` | Invalid input (bad date format, missing required field, negative duration) |
| `CONFLICT` | Edit conflict (entry was modified since last read) |
| `NO_ENTRIES_FOUND` | Query returned zero results |
| `CONFIG_KEY_UNKNOWN` | `config set` with an unrecognized key |
| `CONFIG_VALUE_INVALID` | `config set` with a value that doesn't match the expected type |
| `DATABASE_ERROR` | Unexpected database failure (disk full, corruption, lock timeout) |

---

## 6. Command Surface

### 6.1 Conventions

Every command follows these conventions:

- **Flags are consistent across commands.** `--project`, `--tags`, `--from`, `--to`, `--json` mean the same thing everywhere.
- **IDs are accepted anywhere names are.** If a command takes `--project`, it accepts both a project name (`acme`) and a project ID (`prj_k8f2x`).
- **Dates are flexible on input.** Accept ISO 8601, relative strings (`"2 hours ago"`, `"yesterday 9am"`, `"last monday"`), and common formats (`2026-02-26`, `Feb 26`). All are normalized to ISO 8601 UTC internally.
- **Tags are space-separated or comma-separated.** `--tags backend,urgent` and `--tags backend urgent` both work.
- **Destructive operations require confirmation in TTY mode** but execute immediately with `--yes` or when piped (agents always get immediate execution).

### 6.2 Global Flags

These flags are available on every command and are handled by the interface layer before the command runs.

| Flag | Type | Description |
|---|---|---|
| `--json` | boolean | Force JSON output regardless of TTY detection |
| `--human` | boolean | Force human-readable output even when piped |
| `--yes`, `-y` | boolean | Skip all confirmation prompts (implicit when stdout is not a TTY) |
| `--help`, `-h` | boolean | Show help for the command |
| `--version`, `-v` | boolean | Show clokk version (only on root command) |

### 6.3 Commands

#### Timer Lifecycle

**`clokk start [description]`**
Start a new timer. Fails if a timer is already running.

| Arg/Flag | Type | Required | Description |
|---|---|---|---|
| `description` | positional | no | What you're working on |
| `--project`, `-p` | string | no | Project name or ID |
| `--tags`, `-t` | string[] | no | Tags for categorization |
| `--billable` | boolean | no | Mark as billable (default: from config) |
| `--at` | string | no | Override start time (e.g. `"30 minutes ago"`) |

Returns: The created entry object (with `id`, `start_time`, `end_time: null`).

---

**`clokk stop`**
Stop the currently running timer.

| Arg/Flag | Type | Required | Description |
|---|---|---|---|
| `--at` | string | no | Override stop time |
| `--description`, `-d` | string | no | Update description on stop |
| `--tags`, `-t` | string[] | no | Add/update tags on stop |

Returns: The completed entry object (with `end_time` and computed `duration_seconds`).

---

**`clokk status`**
Show what's currently running. Returns the running entry or a message indicating nothing is active.

| Arg/Flag | Type | Required | Description |
|---|---|---|---|
| (none) | | | |

Returns: `{ running: true, entry: {...}, elapsed_seconds: 3420 }` or `{ running: false }`.

---

**`clokk resume`**
Start a new timer with the same description, project, and tags as the most recently stopped entry.

| Arg/Flag | Type | Required | Description |
|---|---|---|---|
| `--id` | string | no | Resume a specific entry instead of the most recent |

Returns: The new entry object.

---

**`clokk switch [description]`**
Atomic stop-then-start. Stops the current timer and immediately starts a new one. If no description is provided, the agent/user must supply one.

| Arg/Flag | Type | Required | Description |
|---|---|---|---|
| `description` | positional | yes | Description for the new timer |
| `--project`, `-p` | string | no | Project for the new timer |
| `--tags`, `-t` | string[] | no | Tags for the new timer |

Returns: `{ stopped: {...}, started: {...} }` with both entry objects.

---

**`clokk cancel`**
Discard the currently running timer without saving it.

| Arg/Flag | Type | Required | Description |
|---|---|---|---|
| `--yes`, `-y` | boolean | no | Skip confirmation |

Returns: The discarded entry object.

---

#### Entry Management

**`clokk log [description]`**
Add a completed time entry manually (not a running timer).

| Arg/Flag | Type | Required | Description |
|---|---|---|---|
| `description` | positional | no | What was worked on |
| `--project`, `-p` | string | no | Project name or ID |
| `--from` | string | **yes** | Start time |
| `--to` | string | **yes** | End time |
| `--duration` | string | no | Alternative to `--to`: specify duration (e.g. `"1h30m"`) |
| `--tags`, `-t` | string[] | no | Tags |
| `--billable` | boolean | no | Mark as billable (default: from config) |

`--to` and `--duration` are mutually exclusive. If `--duration` is provided, `end_time` is computed as `from + duration`.

Returns: The created entry object.

---

**`clokk edit <entry_id>`**
Modify an existing entry.

| Arg/Flag | Type | Required | Description |
|---|---|---|---|
| `entry_id` | positional | **yes** | Entry ID to edit |
| `--description`, `-d` | string | no | New description |
| `--project`, `-p` | string | no | New project |
| `--from` | string | no | New start time |
| `--to` | string | no | New end time |
| `--tags`, `-t` | string[] | no | Replace tags |
| `--billable` | boolean | no | Update billable status |

Returns: The updated entry object.

---

**`clokk delete <entry_id>`**
Delete a time entry.

| Arg/Flag | Type | Required | Description |
|---|---|---|---|
| `entry_id` | positional | **yes** | Entry ID to delete |
| `--yes`, `-y` | boolean | no | Skip confirmation |

Returns: The deleted entry object.

---

**`clokk list`**
List time entries with filtering.

| Arg/Flag | Type | Required | Description |
|---|---|---|---|
| `--project`, `-p` | string | no | Filter by project |
| `--tags`, `-t` | string[] | no | Filter by tags (AND logic) |
| `--from` | string | no | Entries starting after this time |
| `--to` | string | no | Entries starting before this time |
| `--today` | boolean | no | Shortcut for today's entries |
| `--yesterday` | boolean | no | Shortcut for yesterday's entries |
| `--week` | boolean | no | Shortcut for this week |
| `--month` | boolean | no | Shortcut for this month |
| `--billable` | boolean | no | Filter by billable status |
| `--running` | boolean | no | Show only running entries |
| `--limit`, `-n` | number | no | Max entries to return (default: 50) |
| `--offset` | number | no | Pagination offset |

Returns: `{ entries: [...], total: 142, limit: 50, offset: 0 }`.

---

#### Project Management

**`clokk project create <name>`**

| Arg/Flag | Type | Required | Description |
|---|---|---|---|
| `name` | positional | **yes** | Project name (unique) |
| `--client`, `-c` | string | no | Client name |
| `--rate` | number | no | Hourly rate |
| `--currency` | string | no | Currency code (default: from config) |
| `--color` | string | no | Hex color for TUI/reports |

Returns: The created project object.

---

**`clokk project list`**

| Arg/Flag | Type | Required | Description |
|---|---|---|---|
| `--archived` | boolean | no | Include archived projects |

Returns: `{ projects: [...] }`.

---

**`clokk project edit <name_or_id>`**

| Arg/Flag | Type | Required | Description |
|---|---|---|---|
| `name_or_id` | positional | **yes** | Project name or ID |
| `--name` | string | no | Rename |
| `--client` | string | no | Update client |
| `--rate` | number | no | Update rate |
| `--currency` | string | no | Update currency |
| `--color` | string | no | Update color |

Returns: The updated project object.

---

**`clokk project archive <name_or_id>`**
Soft-delete a project. Existing entries are preserved.

Returns: The archived project object.

---

**`clokk project delete <name_or_id>`**
Permanently delete a project. Fails if entries reference it unless `--force` is passed.

| Arg/Flag | Type | Required | Description |
|---|---|---|---|
| `--force` | boolean | no | Delete even if entries exist (entries become unassigned) |
| `--yes`, `-y` | boolean | no | Skip confirmation |

Returns: The deleted project object.

---

#### Reporting

**`clokk report`**
Generate a time report.

| Arg/Flag | Type | Required | Description |
|---|---|---|---|
| `--project`, `-p` | string | no | Filter by project |
| `--tags`, `-t` | string[] | no | Filter by tags |
| `--from` | string | no | Report period start |
| `--to` | string | no | Report period end |
| `--today` | boolean | no | Shortcut |
| `--yesterday` | boolean | no | Shortcut |
| `--week` | boolean | no | Shortcut (default if no range specified) |
| `--month` | boolean | no | Shortcut |
| `--group-by` | string | no | `project`, `tag`, `day`, `week` (default: `project`) |

Returns:
```json
{
  "period": { "from": "...", "to": "..." },
  "total_seconds": 45360,
  "billable_seconds": 38400,
  "groups": [
    {
      "key": "acme",
      "total_seconds": 28800,
      "billable_seconds": 28800,
      "billable_amount": 1200.00,
      "currency": "USD",
      "entry_count": 12,
      "entries": [...]
    }
  ]
}
```

---

**`clokk export`**
Export entries to a file.

| Arg/Flag | Type | Required | Description |
|---|---|---|---|
| `--format` | string | no | `csv`, `json` (default: `csv`) |
| `--output`, `-o` | string | no | File path (default: stdout) |
| `--project`, `-p` | string | no | Filter by project |
| `--from` | string | no | Start date |
| `--to` | string | no | End date |
| `--week` | boolean | no | Shortcut |
| `--month` | boolean | no | Shortcut |

Returns: File path written, or streams data to stdout.

---

#### Configuration

**`clokk config show`**
Display all current configuration.

Returns: Full config object.

---

**`clokk config set <key> <value>`**
Set a configuration value.

Returns: The updated key-value pair.

---

**`clokk config get <key>`**
Get a single configuration value.

Returns: The key-value pair.

---

#### Agent Discoverability

**`clokk schema`**
Output the complete CLI interface as structured JSON. This is the primary mechanism for AI agent self-onboarding — an agent reads this once and understands every command, argument, type, and default.

Returns:
```json
{
  "name": "clokk",
  "version": "1.0.0",
  "description": "Local-first CLI time tracker",
  "commands": {
    "start": {
      "description": "Start a new timer",
      "args": {
        "description": { "type": "string", "positional": true, "required": false }
      },
      "flags": {
        "project": { "type": "string", "alias": "p", "description": "Project name or ID" },
        "tags": { "type": "string[]", "alias": "t", "description": "Tags for categorization" },
        "billable": { "type": "boolean", "default": true },
        "at": { "type": "string", "description": "Override start time" }
      },
      "errors": ["TIMER_ALREADY_RUNNING", "PROJECT_NOT_FOUND", "VALIDATION_ERROR"]
    }
  }
}
```

---

**`clokk commands`**
List all available commands with brief descriptions. A lightweight alternative to `schema` for quick orientation.

Returns:
```json
{
  "commands": [
    { "name": "start", "description": "Start a new timer", "alias": null },
    { "name": "stop", "description": "Stop the current timer", "alias": null }
  ]
}
```

---

## 7. Data Schema

All tables use text IDs with prefixed namespaces for readability (`prj_`, `ent_`). Timestamps are ISO 8601 UTC. Tags are stored as JSON arrays.

### projects

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | text | PK | `prj_` prefixed |
| name | text | unique, not null | Human-readable name |
| client | text | nullable | Client/company name |
| color | text | nullable | Hex color |
| rate | real | nullable | Hourly billing rate |
| currency | text | default `'USD'` | ISO 4217 currency code |
| archived | integer | default `0` | Soft delete flag |
| created_at | text | default `now()` | ISO 8601 |
| updated_at | text | default `now()` | ISO 8601 |

### entries

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | text | PK | `ent_` prefixed |
| project_id | text | FK → projects.id, nullable | Associated project |
| description | text | default `''` | What was worked on |
| start_time | text | not null | ISO 8601 UTC |
| end_time | text | nullable | Null means timer is running |
| tags | text | default `'[]'` | JSON array of strings |
| billable | integer | default `1` | Boolean as integer |
| created_at | text | default `now()` | ISO 8601 |
| updated_at | text | default `now()` | ISO 8601 |

**Note:** `duration_seconds` is **not stored** in the database. It is computed from `end_time - start_time` by the core layer when building response objects. This avoids denormalization issues when entries are edited — changing `start_time` or `end_time` automatically updates the duration without requiring a separate column update.

### Indexes

- `idx_entries_start` on `entries(start_time)` — for date range queries
- `idx_entries_project` on `entries(project_id)` — for project filtering
- `idx_entries_end` on `entries(end_time)` — for finding running timers (`WHERE end_time IS NULL`)
- `idx_projects_name` on `projects(name)` — for name lookups

### Foreign Key Behavior

- `entries.project_id` → `projects.id` with `ON DELETE SET NULL`. When a project is force-deleted, its entries become unassigned rather than being deleted.
- The `project delete` command without `--force` checks for referencing entries and fails with `PROJECT_HAS_ENTRIES` if any exist.

---

## 8. Configuration

Configuration is stored at `~/.clokk/config.json`. The database lives at `~/.clokk/clokk.db`. Both paths can be overridden with the `CLOKK_DIR` environment variable.

### Directory Initialization

On first run, clokk creates the `~/.clokk/` directory (or `$CLOKK_DIR`) if it doesn't exist, writes a default `config.json`, and runs database migrations to create the schema. This happens silently — no setup wizard.

### Config Keys

| Key | Type | Default | Description |
|---|---|---|---|
| `default_project` | string | `null` | Project used when `--project` is omitted |
| `default_billable` | boolean | `true` | Default billable status |
| `default_currency` | string | `"USD"` | Default currency for new projects |
| `week_start` | string | `"monday"` | Start of week for `--week` reports |
| `date_format` | string | `"iso"` | Display format for dates in human mode |
| `turso.url` | string | `null` | Turso sync URL (enables cloud sync) |
| `turso.token` | string | `null` | Turso auth token |

When `turso.url` is set, clokk switches from bun:sqlite to the libsql client with embedded replica sync. The local database file remains the same; it just gains a sync target.

### Environment Variables

| Variable | Description |
|---|---|
| `CLOKK_DIR` | Override the config/data directory (default: `~/.clokk`) |
| `CLOKK_OUTPUT` | Force output format: `json` or `human` |
| `NO_COLOR` | Disable colors in human output (standard convention) |
| `TZ` | Override timezone for display (storage is always UTC) |

---

## 9. Agent Workflow Stories

These are the real-world sequences an AI agent would execute. They validate that the command surface works end-to-end.

### 9.1 Track a day of work

```
clokk start "Standup" --project team-meetings --tags sync
  # ... time passes ...
clokk switch "Feature: auth flow" --project acme --tags backend,auth
  # ... time passes ...
clokk switch "Code review" --project acme --tags review
  # ... time passes ...
clokk stop
```

### 9.2 Check what's running and how long

```
clokk status
# → { "running": true, "entry": { "id": "ent_x2f", "description": "Feature: auth flow", ... }, "elapsed_seconds": 2340 }
```

### 9.3 Log time retroactively

```
clokk log "Client call" --project acme --from "today 2pm" --to "today 3:30pm" --tags meeting
```

### 9.4 Generate a weekly summary for standup

```
clokk report --week --group-by day
```

### 9.5 Find out how much to bill a client

```
clokk report --project acme --month --json
# Agent reads .billable_seconds and .billable_amount from each group
```

### 9.6 Fix a mistake

```
clokk list --today --json
# Agent reads entry IDs from the response
clokk edit ent_k8f2x --from "today 9:00am" --to "today 10:30am"
```

### 9.7 Set up a new project

```
clokk project create "acme-redesign" --client "Acme Corp" --rate 150 --currency USD
```

### 9.8 Export for invoicing

```
clokk export --project acme --month --format csv --output ./acme-feb-2026.csv
```

### 9.9 Agent self-onboarding

An AI agent encountering clokk for the first time would run:

```
clokk schema --json
```

This single command returns the complete interface definition. The agent now knows every command, argument, type, default, and possible error code without reading documentation.

---

## 10. Error Handling Principles

1. **Errors are recoverable by default.** Every error message tells you what went wrong AND what to do about it.
2. **Suggestions are executable.** The `suggestions` array contains exact commands that can be copy-pasted (or executed by an agent).
3. **Context is included.** If an error references an entity, its ID and key properties are in `context`.
4. **Exit codes are meaningful.** `0` = success, `1` = user/input error, `2` = system error.
5. **Agents never see ambiguity.** No "something went wrong" — always a specific code and path forward.

---

## 11. Duration Handling

Durations appear in two forms:

- **Stored/returned:** Always integer seconds in JSON (`"duration_seconds": 5400`)
- **Displayed to humans:** Formatted as `1h 30m`, `45m`, `2h 15m 30s`
- **Accepted as input:** Flexible parsing — `"1h30m"`, `"1.5h"`, `"90m"`, `"90 minutes"`, `"1:30:00"`

The core layer only deals in seconds. Parsing and formatting happen in the interface layer.

### Duration Parsing Rules

Input is parsed in the interface layer (`src/cli/parse.ts`) before reaching core functions.

| Input | Parsed as |
|---|---|
| `"1h30m"` or `"1h 30m"` | 5400 seconds |
| `"1.5h"` | 5400 seconds |
| `"90m"` or `"90 minutes"` | 5400 seconds |
| `"1:30:00"` | 5400 seconds (HH:MM:SS) |
| `"0:45"` | 2700 seconds (MM:SS or HH:MM — resolved by magnitude) |
| `"30s"` or `"30 seconds"` | 30 seconds |

If parsing fails, the core layer receives a `VALIDATION_ERROR` before execution.

---

## 12. Date/Time Handling

- **Storage:** All timestamps are ISO 8601 UTC (`2026-02-26T14:30:00.000Z`)
- **Input:** The CLI accepts a wide range of formats and normalizes them. Relative times (`"2 hours ago"`, `"yesterday 3pm"`) are resolved at parse time against the system clock.
- **Output (JSON):** Always ISO 8601 UTC
- **Output (human):** Respects `config.date_format` and system locale
- **Timezone:** clokk stores everything in UTC. Display conversion uses the system timezone unless overridden by `TZ` env var.

### Date Parsing Strategy

Date parsing uses `dayjs` for absolute dates with a custom layer on top for relative expressions. The relative parser handles a deliberate subset of natural language:

| Input | Resolved to |
|---|---|
| `"now"` | Current time |
| `"today 9am"`, `"today 14:30"` | Today at the specified time |
| `"yesterday"`, `"yesterday 5pm"` | Yesterday (midnight or specified time) |
| `"2 hours ago"`, `"30 minutes ago"` | Relative to now |
| `"last monday"`, `"last friday 3pm"` | Most recent occurrence of that weekday |
| `"2026-02-26"`, `"Feb 26"`, `"Feb 26 2026"` | Absolute date (midnight in local tz, converted to UTC) |
| `"2026-02-26T14:30:00Z"` | ISO 8601 passed through directly |

If a date string cannot be parsed, the command fails with `VALIDATION_ERROR` and a message showing the input that failed and the accepted formats.

### Why dayjs

dayjs is ~2KB, immutable by default, and supports the UTC and timezone plugins needed for clokk's conversion logic. It avoids the weight of `moment` and the browser-focused API of `date-fns`. The relative time parsing ("2 hours ago", "yesterday 3pm") is a thin custom parser on top — about 50 lines of pattern matching — rather than a full NLP library.

---

## 13. ID Generation

IDs are prefixed, timestamped, and random:

- Format: `{prefix}_{base36_timestamp}{random_6}`
- Example: `ent_m3kf9xa8b2` (entry), `prj_m3kf9x7c1d` (project)
- Prefix makes IDs self-describing in logs, errors, and debugging
- Base36 timestamp provides natural chronological ordering
- Random suffix prevents collisions

IDs are generated using `nanoid` for the random component and `Date.now().toString(36)` for the timestamp component. The combined format provides both sortability and uniqueness without coordination.

---

## 14. Distribution Plan

### npm (primary)

```bash
# Global install
npm install -g clokk
bunx clokk start "working"
npx clokk start "working"
```

Package name: `clokk`. Binary name: `clokk`.

### Compiled binaries (GitHub Releases)

```bash
# Download and run — no runtime needed
curl -fsSL https://github.com/<org>/clokk/releases/latest/download/clokk-$(uname -s)-$(uname -m) -o clokk
chmod +x clokk
./clokk start "working"
```

Built with `bun build --compile` for linux-x64, linux-arm64, darwin-x64, darwin-arm64, windows-x64.

### Homebrew (Mac/Linux)

```bash
brew install <org>/tap/clokk
```

A Homebrew tap that downloads the compiled binary from GitHub Releases.

---

## 15. Future: Accounts & Sync (Phase 2)

When `turso.url` and `turso.token` are configured, clokk switches to the libsql adapter with embedded replicas.

- The local SQLite file becomes an embedded replica that syncs to Turso
- Reads remain instant (local file)
- Writes go to the local file and sync in the background
- Offline mode works automatically — sync resumes when connectivity returns
- The schema is identical; no migration needed
- A `clokk sync` command triggers a manual sync
- A `clokk auth login` flow provisions Turso credentials

This transition requires no changes to the core layer. Only the data layer initialization changes.

---

## 16. Future: TUI (Phase 3)

The TUI is built with Ink (React for terminals) and consumes the exact same core layer.

- Live-updating status display
- Interactive project/tag selection
- Report visualization with terminal charts
- Keyboard shortcuts for start/stop/switch
- Split pane: running timer + recent entries

The TUI is a separate entry point (`clokk --tui` or `clokk ui`) that imports from `src/core/` just like the CLI does.

---

## 17. Testing Strategy

- **Core layer:** Unit tests for every function. Input → output. No mocks needed because the repository is injected.
- **Data layer:** Integration tests against an in-memory SQLite database.
- **CLI layer:** Integration tests that spawn the actual CLI process, pass args, and assert on JSON output. This validates the full pipeline including arg parsing and output formatting.
- **Agent simulation:** A test suite that runs the workflow stories from Section 9 end-to-end, verifying that an agent could execute them successfully using only the information from `clokk schema`.

### Running Tests

```bash
bun test                    # Run all tests
bun test tests/core         # Run core unit tests only
bun test tests/cli          # Run CLI integration tests only
bun test tests/workflows    # Run agent workflow simulations
```

### CI Pipeline

Tests should run on every push and PR via GitHub Actions. The CI workflow:

1. **Lint** — TypeScript type checking with `tsc --noEmit`
2. **Test** — `bun test` (all test suites)
3. **Build** — `bun build --compile` to verify the binary compiles
4. **Release** (on tag) — Compile binaries for all platforms, publish to npm, create GitHub release

---

## 18. Non-Goals

Things clokk explicitly does not try to do:

- **Real-time collaboration.** clokk is single-user (with cloud backup). Team features are out of scope.
- **Invoicing.** clokk exports data for invoicing tools. It does not generate invoices.
- **Integrations with project management tools.** No Jira, GitHub, or Asana integration in core. These could be built as separate tools that read clokk's data.
- **Screenshots or activity monitoring.** clokk tracks time, not behavior.
- **Mobile app.** The CLI and TUI are terminal-only. Mobile access can come through the Turso-synced data if needed.
