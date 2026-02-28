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
| TUI | OpenTUI + SolidJS | Bun-native, Zig core, cell-level diffing, shares core layer with CLI |
| MCP Server | `@modelcontextprotocol/sdk` | Exposes clokk as typed tools for AI agents via Model Context Protocol |

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
| `@modelcontextprotocol/sdk` | MCP server — typed tool definitions, stdio transport |
| `zod` | Schema validation — input schemas for MCP tools (peer dependency of MCP SDK) |

Dev dependencies: `typescript`, `@types/bun`, `drizzle-kit`.

---

## 3. Architecture

clokk uses a three-layer architecture. The layers communicate through typed interfaces, never through formatted strings or CLI flags.

```
┌──────────────────────────────────────────────────────┐
│  Interface Layer (swappable)                         │
│  ┌───────┐  ┌───────┐  ┌───────────┐  ┌──────────┐  │
│  │  CLI  │  │  TUI  │  │ MCP Server│  │ Hooks/   │  │
│  │       │  │       │  │ (agents)  │  │ Skills   │  │
│  └───┬───┘  └───┬───┘  └─────┬─────┘  └────┬─────┘  │
│      │          │             │              │        │
│  Parses input, formats output, handles I/O           │
├──────┴──────────┴─────────────┴──────────────┴───────┤
│  Core Layer (business logic)                         │
│                                                      │
│  Pure functions. No I/O formatting.                  │
│  Takes typed objects, returns typed objects.          │
│  Throws typed errors.                                │
├──────────────────────────────────────────────────────┤
│  Data Layer (storage)                                │
│                                                      │
│  Repository interface with two backends:             │
│  • SqliteRepository (bun:sqlite, local)              │
│  • TursoRepository (libsql, sync)                    │
└──────────────────────────────────────────────────────┘
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
│   ├── tui/                   # TUI interface (OpenTUI + SolidJS)
│   │   ├── index.ts           # Entry point (clokk ui)
│   │   ├── app.tsx            # Root component, layout, context
│   │   ├── components/        # Timer, entry list, project picker, reports
│   │   └── hooks/             # use-timer, use-entries, use-repo
│   │
│   └── mcp/                   # MCP server interface (agent integration)
│       ├── server.ts          # McpServer setup, stdio transport, tool registration
│       └── tools/             # Tool handlers grouped by domain
│           ├── timer.ts       # start_timer, stop_timer, switch_timer, timer_status, resume_timer, cancel_timer
│           ├── entries.ts     # log_entry, list_entries, edit_entry, delete_entry
│           ├── projects.ts    # list_projects, create_project, edit_project
│           └── reports.ts     # generate_report, export_entries
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

An AI agent encountering clokk for the first time has two paths:

**Path A: MCP Server (preferred).** The agent's host (Claude Code, Cursor, etc.) has clokk configured as an MCP server. All tools are self-describing with typed schemas — the agent can immediately call `start_timer`, `stop_timer`, etc. without any discovery step. See §18.

**Path B: CLI discovery.** The agent runs:

```
clokk schema --json
```

This single command returns the complete interface definition. The agent now knows every command, argument, type, default, and possible error code without reading documentation.

### 9.10 Automatic time tracking via hooks

An agent session automatically tracks time without any manual intervention:

```
# SessionStart hook fires → clokk start "Working on <project>"
# ... agent works for 2 hours ...
# Stop hook fires → clokk stop
```

The developer reviews their day with `clokk report --today` and sees accurate, automated entries for every agent session. See §18.3.

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

Package name: `clokk`. Binary name: `clokk`. The npm package distributes TypeScript source — Bun is required to run it. The `bin` field points to `src/cli/index.ts`.

```json
{
  "files": ["src/", "drizzle/", "package.json", "tsconfig.json"],
  "publishConfig": { "access": "public" }
}
```

npm provenance is enabled via OIDC trusted publishing in the GitHub Actions release workflow. This signs packages with Sigstore and proves they were built by CI, not a local machine.

### Compiled binaries (GitHub Releases)

```bash
# Download and run — no runtime needed
curl -fsSL https://github.com/<org>/clokk/releases/latest/download/clokk-$(uname -s)-$(uname -m) -o clokk
chmod +x clokk
./clokk start "working"
```

Built with `bun build --compile` for 5 targets:

| Target flag | Output file | Runner |
|---|---|---|
| `bun-darwin-x64` | `clokk-darwin-x64` | `macos-latest` |
| `bun-darwin-arm64` | `clokk-darwin-arm64` | `macos-14` |
| `bun-linux-x64` | `clokk-linux-x64` | `ubuntu-latest` |
| `bun-linux-arm64` | `clokk-linux-arm64` | `ubuntu-latest` |
| `bun-windows-x64` | `clokk-windows-x64.exe` | `windows-latest` |

Each release includes a `checksums.txt` with SHA256 hashes for all binaries, generated in CI and attached to the GitHub Release.

### Homebrew (Mac/Linux)

```bash
brew tap <org>/tap
brew install clokk
```

A separate `homebrew-tap` repository contains the formula:

```
homebrew-tap/
├── Formula/
│   └── clokk.rb
└── README.md
```

The formula downloads platform-specific binaries from GitHub Releases using `on_macos`/`on_linux` + `on_arm`/`on_intel` blocks. SHA256 checksums are read from `checksums.txt`. The release workflow automatically pushes a formula update to the tap repo after each release.

---

## 15. Future: Accounts & Sync (Phase 2)

Turso embedded replicas are a natural fit for clokk's sync story. Reads always hit the local SQLite file (microsecond latency). Writes go to the local file first, then sync to the cloud in the background — the CLI never blocks on network. Offline mode is automatic. The tradeoff is switching from Bun's native SQLite driver to `@libsql/client`, which is async-only and slightly slower for writes. For a CLI doing 1–5 operations per command, the difference is imperceptible.

When `turso.url` and `turso.token` are configured, clokk switches from `bun:sqlite` to the libsql client with embedded replicas. The local database file remains the same — it gains a cloud sync target.

### How it works

- The local SQLite file (`~/.clokk/clokk.db`) becomes an embedded replica that syncs to a Turso cloud database
- Reads remain instant (always from the local file, microsecond latency)
- Writes go to the local file first, then sync to the remote on a configurable interval (default 60s) — the CLI command returns immediately
- Offline mode works automatically — sync resumes when connectivity returns
- The Drizzle schema is identical across both backends; no migration changes needed

### Performance notes

`@libsql/client` uses its own SQLite fork (libsql) rather than Bun's native `bun:sqlite` binding. This means:

- **Reads**: No measurable difference — both serve from the local file.
- **Writes**: libsql's default `PRAGMA synchronous = FULL` is conservative. Batch inserts can be 50–60x slower than `bun:sqlite` unless overridden to `synchronous = NORMAL` (which clokk should set explicitly). Per-operation, the difference is sub-millisecond and imperceptible.
- **API**: `@libsql/client` is async-only. For a CLI that does one thing and exits, this adds minor event loop overhead compared to `bun:sqlite`'s synchronous API.
- **Compatibility**: Early versions had Bun stability issues (SIGKILL crashes). Test thoroughly with the latest `@libsql/client` release before shipping.

Users who don't need sync pay no cost — they stay on `bun:sqlite` by default. The libsql driver is only loaded when Turso credentials are configured.

### Package & adapter

Use `@libsql/client` (v0.17+), the async Turso client — not the synchronous `libsql` package. The Drizzle adapter changes from `drizzle-orm/bun-sqlite` to `drizzle-orm/libsql`. Same schema, same queries, only the driver initialization differs.

```ts
// src/data/turso.ts
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

const client = createClient({
  url: "file:~/.clokk/clokk.db",       // Local replica file
  syncUrl: config.turso.url,             // Remote Turso database
  authToken: config.turso.token,         // Auth token
  syncInterval: 60,                      // Background sync every 60s
});

const db = drizzle(client, { schema });
```

### Factory update

`createRepository()` in `src/data/factory.ts` checks `config.turso.url`:

- **Set** → creates `TursoRepository` (using `@libsql/client` + `drizzle-orm/libsql`)
- **Not set** → creates `SqliteRepository` (using `bun:sqlite` + `drizzle-orm/bun-sqlite`, as today)

### New file: `src/data/turso.ts`

`TursoRepository` mirrors the structure of `SqliteRepository` — implements the same `Repository` interface, uses the same `toEntry()`/`toProject()` mappers. The Drizzle query API is identical; only the database type changes from `BunSQLiteDatabase` to `LibSQLDatabase`.

### New commands

**`clokk sync`** — Triggers a manual `client.sync()` call. Returns sync status (last sync time, entries synced). Useful after offline periods or before switching devices.

**`clokk auth login`** — Provisions Turso credentials:
1. Prompts user to create or select a Turso database (via Turso API or directs them to Turso CLI)
2. Writes `turso.url` and `turso.token` to `~/.clokk/config.json`
3. Runs an initial sync to populate the remote database with local data

**`clokk auth logout`** — Removes Turso credentials from config, reverts to local-only mode. Existing local data is preserved.

### What doesn't change

- **Core layer** — no changes. Core functions still receive `Repository`, unaware of the backend.
- **CLI commands** — no changes. Same input/output contract.
- **Schema** — identical Drizzle schema shared across both backends.
- **Existing tests** — continue to use in-memory `bun:sqlite`. New tests for `TursoRepository` use in-memory libsql.

---

## 16. Future: TUI (Phase 3)

The TUI is built with [OpenTUI](https://github.com/anomalyco/opentui) and consumes the exact same core layer.

### Why OpenTUI

OpenTUI is a terminal UI framework with a native Zig core and TypeScript bindings. It was chosen over Ink (React for terminals) for these reasons:

| Consideration | OpenTUI | Ink |
|---|---|---|
| Bun support | Native (built for Bun) | Via Node compat layer |
| Rendering | Cell-level smart diffing (incremental) | Full React reconciliation + redraw |
| Live updates | Designed for high-frequency re-renders | Works, but heavier overhead per frame |
| Framework lock-in | React, Solid, or Vue reconcilers | React only |
| Philosophy | Matches clokk's modern-tooling choices | Battle-tested but heavier |

Ink remains a proven alternative (35k stars, used by GitHub Copilot, Prisma, Claude Code). If OpenTUI causes issues, `@opentui/react` and Ink share a similar React component model, making migration straightforward.

### Architecture

```
src/tui/
├── index.ts              # Entry point (invoked via `clokk ui`)
├── app.tsx               # Root component, layout, context providers
├── components/
│   ├── timer.tsx          # Live timer display with elapsed time
│   ├── entry-list.tsx     # Scrollable list of recent entries
│   ├── project-picker.tsx # Interactive project/tag selection
│   ├── report-view.tsx    # Report visualization
│   └── status-bar.tsx     # Bottom bar with keyboard shortcut hints
└── hooks/
    ├── use-timer.ts       # Polls getStatus() at 200ms, manages timer state
    ├── use-entries.ts     # Fetches and caches entry list
    └── use-repo.ts        # Provides repository via context
```

The TUI is a separate entry point registered as the `clokk ui` command. It imports from `src/core/` and `src/data/` using the same dependency injection pattern as the CLI — `createRepository()` → pass `repo` through context → components call core functions.

### Key features

- **Live timer display** — Polls `getStatus()` every 200ms via `setInterval`. OpenTUI's incremental rendering ensures only the timer digits re-render, not the entire screen.
- **Split-pane layout** — Flexbox via Yoga. Left/top pane shows the running timer with controls; right/bottom pane shows recent entries.
- **Keyboard shortcuts** — OpenTUI supports the Kitty keyboard protocol for precise key detection. Bindings: `s` start, `x` stop, `w` switch, `r` resume, `c` cancel, `q` quit, `?` help overlay.
- **Interactive selection** — Project and tag pickers using OpenTUI's built-in `Select` component with fuzzy filtering.
- **Entry list** — Paginated, scrollable with `j`/`k` or arrow keys. Focus management via OpenTUI's built-in focus system.
- **Report visualization** — Grouped time summaries rendered as bar charts using ASCII box-drawing characters.

### Dependencies

```json
{
  "@opentui/core": "^0.1.x",
  "@opentui/react": "^0.1.x",
  "react": "^18.x"
}
```

Or, if using the SolidJS reconciler (better performance for large entry lists):

```json
{
  "@opentui/core": "^0.1.x",
  "@opentui/solid": "^0.1.x",
  "solid-js": "^1.x"
}
```

### Phased implementation

1. **Phase 1 — Timer MVP**: Live timer display, start/stop/switch via keyboard, basic entry list below timer.
2. **Phase 2 — Interactivity**: Project/tag picker overlays, entry list filtering, scrollable navigation.
3. **Phase 3 — Reports**: Report visualization within TUI, date range navigation, export triggers.

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

Two GitHub Actions workflows, both using `oven-sh/setup-bun@v2`.

**CI workflow** (`.github/workflows/ci.yml`) — runs on every push and PR:

1. **Lint** — `bun tsc --noEmit` (strict mode type checking)
2. **Test** — `bun test` (all test suites)
3. **Build smoke test** — `bun build ./src/cli/index.ts --compile --outfile dist/clokk` to verify compilation succeeds

**Release workflow** (`.github/workflows/release.yml`) — runs on `v*` tag push:

1. **Matrix build** — compile binaries for all 5 targets in parallel (see §14 for target table)
2. **Upload artifacts** — each binary uploaded via `actions/upload-artifact@v4`
3. **Create GitHub Release** — `softprops/action-gh-release@v1` with all binaries + `checksums.txt` (SHA256)
4. **Publish to npm** — `bun publish --access public` with provenance via OIDC trusted publishing
5. **Update Homebrew tap** — push updated formula with new version and checksums to the `homebrew-tap` repository

The matrix strategy uses platform-specific runners: `ubuntu-latest` for Linux targets, `macos-latest` for darwin-x64, `macos-14` for darwin-arm64, `windows-latest` for Windows. Tests and lint run once (not per-platform) before the matrix build starts.

---

## 18. Agent Integration

clokk is designed for both humans and AI agents (§1). The CLI's structured JSON output (§5), self-describing schema (§6.3), and typed error codes (§5.4) form the foundation. This section specifies four complementary integration mechanisms that make clokk a first-class tool for AI coding agents.

### Why agents need more than a good CLI

Unlike well-known tools (`git`, `gh`, `docker`), **no LLM has training data about clokk**. When an agent encounters clokk for the first time via CLI, it must:

1. Guess that `clokk schema` or `clokk --help` exists
2. Parse the output format to learn available commands
3. Construct shell commands by trial and error

An MCP server eliminates this entirely — tools are self-describing with typed input schemas. A skill file provides natural-language guidance. Hooks enable fully automatic tracking with zero agent involvement.

### 18.1 MCP Server

The MCP (Model Context Protocol) server is the primary agent integration. It exposes clokk's core functions as typed tools that any MCP-compatible host (Claude Code, Cursor, Windsurf, etc.) can discover and invoke directly.

#### Architecture

The MCP server is another interface layer — architecturally identical to CLI and TUI. It follows the same pattern: receive input → call core function with injected repository → return structured result.

```
src/mcp/
├── server.ts          # McpServer setup, stdio transport, tool registration
└── tools/
    ├── timer.ts       # start_timer, stop_timer, switch_timer, timer_status, resume_timer, cancel_timer
    ├── entries.ts     # log_entry, list_entries, edit_entry, delete_entry
    ├── projects.ts    # list_projects, create_project, edit_project
    └── reports.ts     # generate_report, export_entries
```

#### Entry point

The MCP server is launched via `clokk mcp serve`. It communicates over stdio using JSON-RPC (the MCP transport protocol). The server process must never write to stdout except through the MCP transport — all logging goes to stderr.

```ts
// src/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "clokk",
  version: "1.0.0",
});

// Register all tools (see below)
registerTimerTools(server, repo);
registerEntryTools(server, repo);
registerProjectTools(server, repo);
registerReportTools(server, repo);

const transport = new StdioServerTransport();
await server.connect(transport);
```

#### Tool design principles

1. **One tool per action.** `start_timer`, `stop_timer`, `list_entries` — not a generic `execute_command` tool. Focused tools produce better agent behavior than kitchen-sink endpoints.
2. **Rich descriptions.** Each tool description explains **when** to use it, not just what it does. Include cross-references between tools (e.g., "Use list_projects to find available project IDs").
3. **Zod input schemas.** Every parameter has a type, description, and optionality annotation. The schema is the documentation — agents read it to understand the API.
4. **Annotations.** Mark tools with `readOnlyHint`, `destructiveHint`, and `idempotentHint` so hosts can make informed permission decisions.
5. **Minimal output.** Return only the fields the agent needs. Don't echo the entire database row if the agent only needs the ID and status.

#### Tool definitions

**Timer tools:**

| Tool | Description | Inputs | Annotations |
|------|------------|--------|-------------|
| `start_timer` | Start a new time tracking timer. Only one timer can run at a time. Use `switch_timer` to transition between tasks. | `description?`, `project?`, `tags?`, `billable?` | destructive: false, idempotent: false |
| `stop_timer` | Stop the currently running timer. | `description?`, `tags?` | destructive: false, idempotent: false |
| `switch_timer` | Atomically stop the current timer and start a new one. Preferred over separate stop+start calls. | `description`, `project?`, `tags?` | destructive: false, idempotent: false |
| `timer_status` | Check if a timer is currently running. Returns the running entry with elapsed seconds, or running: false. | (none) | readOnly: true |
| `resume_timer` | Start a new timer cloning the description, project, and tags from the most recently stopped entry. | `id?` | destructive: false, idempotent: false |
| `cancel_timer` | Discard the running timer without saving. The entry is permanently deleted. | (none) | destructive: true, idempotent: true |

**Entry tools:**

| Tool | Description | Inputs | Annotations |
|------|------------|--------|-------------|
| `log_entry` | Log a completed time entry (not a running timer). Requires `from`; provide either `to` or `duration`. | `description?`, `project?`, `from`, `to?`, `duration?`, `tags?`, `billable?` | destructive: false |
| `list_entries` | List time entries with optional filters. Returns entries and total count. | `project?`, `tags?`, `from?`, `to?`, `billable?`, `running?`, `limit?`, `offset?` | readOnly: true |
| `edit_entry` | Modify an existing time entry. Only provided fields are updated. | `id`, `description?`, `project?`, `from?`, `to?`, `tags?`, `billable?` | destructive: false |
| `delete_entry` | Permanently delete a time entry. | `id` | destructive: true, idempotent: true |

**Project tools:**

| Tool | Description | Inputs | Annotations |
|------|------------|--------|-------------|
| `create_project` | Create a new project. Names must be unique. | `name`, `client?`, `rate?`, `currency?`, `color?` | destructive: false |
| `list_projects` | List all projects. Use `archived` flag to include archived projects. | `archived?` | readOnly: true |
| `edit_project` | Update a project's properties. | `id`, `name?`, `client?`, `rate?`, `currency?`, `color?` | destructive: false |

**Report tools:**

| Tool | Description | Inputs | Annotations |
|------|------------|--------|-------------|
| `generate_report` | Generate a time report grouped by project, tag, day, or week. | `project?`, `tags?`, `from?`, `to?`, `group_by?` | readOnly: true |
| `export_entries` | Export time entries as CSV or JSON. | `format?`, `project?`, `from?`, `to?` | readOnly: true |

#### Tool handler pattern

Each tool handler follows the same pattern as CLI commands — get the repository, call the core function, return the result:

```ts
server.tool(
  "start_timer",
  "Start a new time tracking timer. Only one timer can run at a time. "
    + "Use switch_timer to transition between tasks without stopping.",
  {
    description: z.string().optional().describe("What you are working on"),
    project: z.string().optional()
      .describe("Project name or ID (prj_ prefix). Use list_projects to find available projects."),
    tags: z.array(z.string()).optional().describe("Tags to categorize this entry"),
    billable: z.boolean().optional().describe("Mark as billable (defaults to config setting)"),
  },
  async (input) => {
    const result = await startTimer(repo, {
      description: input.description,
      project: input.project,
      tags: input.tags,
      billable: input.billable,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  }
);
```

#### Error handling

Core functions throw typed `ClokkError` instances. The MCP tool handler catches these and returns them as structured error content:

```ts
async function handleToolCall<T>(fn: () => Promise<T>): Promise<CallToolResult> {
  try {
    const result = await fn();
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  } catch (err) {
    if (err instanceof ClokkError) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: err.code,
            message: err.message,
            suggestions: err.suggestions,
          }),
        }],
        isError: true,
      };
    }
    throw err;
  }
}
```

#### Configuration

Users add clokk as an MCP server in their agent's configuration:

**Claude Code (`.mcp.json` at project root, committed to git):**
```json
{
  "mcpServers": {
    "clokk": {
      "command": "clokk",
      "args": ["mcp", "serve"],
      "env": {}
    }
  }
}
```

**Claude Code (user-level, `~/.claude.json`):**
```bash
claude mcp add --transport stdio clokk -- clokk mcp serve
```

#### Why MCP for clokk specifically

| Factor | Assessment |
|--------|-----------|
| LLM familiarity | **None** — no training data about clokk exists. MCP schemas teach the model the API. |
| Tool count | **~15 tools** — well under the ~50 tool threshold where context flooding becomes a concern. |
| Architecture fit | **Perfect** — MCP server is just another interface layer calling the same core functions. |
| Stateful benefit | The MCP server process maintains the DB connection for the session, avoiding per-command startup cost. |
| Host support | Claude Code, Cursor, Windsurf, Cline, and other MCP-compatible hosts. |

### 18.2 Agent Skill

An Agent Skill is a markdown file (`SKILL.md`) that teaches LLM-based coding agents how to use clokk via CLI. Skills follow the [AgentSkills open standard](https://skills.sh/) supported by Claude Code, OpenClaw, Cursor, and others.

The skill is a lightweight alternative to MCP — it works with any agent that supports bash execution, without requiring MCP server configuration. It's especially useful for OpenClaw, which uses skills as its primary extension mechanism.

#### SKILL.md

```markdown
---
name: clokk
description: Track time spent on coding tasks. Start/stop timers, log entries, manage projects, generate reports.
version: 1.0.0
metadata:
  openclaw:
    requires:
      bins:
        - clokk
    emoji: "clock"
    install:
      - kind: brew
        formula: clokk
        bins:
          - clokk
      - kind: node
        package: clokk
        bins:
          - clokk
---

# clokk — Time Tracking

Track time spent on coding tasks directly from the terminal.

## Quick Reference

- `clokk start "description" --project name` — Start a timer
- `clokk stop` — Stop the running timer
- `clokk switch "new task" --project name` — Stop current, start new (preferred for task transitions)
- `clokk status --json` — Check if a timer is running
- `clokk list --today --json` — List today's entries
- `clokk report --week --json` — Weekly time summary

## Rules

- Always pass `--json` for structured output (or pipe, which auto-selects JSON).
- Only one timer can run at a time. Use `switch` for transitions, not `stop` + `start`.
- Use `--yes` or `-y` to skip confirmation prompts.
- Project can be a name ("acme") or ID ("prj_abc123").
- For full command schema: `clokk schema --json`
```

#### Distribution

The skill file ships in the clokk repository at `skills/SKILL.md` and can be installed via:

```bash
# Claude Code / compatible agents
npx skills add clokk

# OpenClaw
# Auto-discovered if clokk binary is on PATH (via requires.bins)
```

### 18.3 Claude Code Hooks

Hooks enable **automatic time tracking** — the agent codes, clokk tracks, with zero manual intervention. This is the highest-value integration for developers who use AI coding agents daily.

#### How it works

Claude Code fires lifecycle events at specific points. Shell scripts configured as hooks run in response to these events, calling clokk CLI commands.

| Hook Event | Action | Behavior |
|-----------|--------|----------|
| `SessionStart` | `clokk start` | Start a timer when a Claude Code session begins. Description derived from project directory name. |
| `Stop` | `clokk stop` | Stop the timer when the session ends (agent is done, user exits). |
| `Notification` | (optional) | Could log context switches or long-running task boundaries. |

#### Configuration

Users add hooks to their Claude Code settings (`~/.claude/settings.json`):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [{
          "type": "command",
          "command": "clokk start \"Claude Code session\" --project \"$(basename $PWD)\" --tags agent,claude-code --yes 2>/dev/null || true"
        }]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [{
          "type": "command",
          "command": "clokk stop --yes 2>/dev/null || true"
        }]
      }
    ]
  }
}
```

#### Design decisions

- **Fail silently.** Hooks append `2>/dev/null || true` so clokk errors (e.g., timer already running from a previous session) never block the agent.
- **Project from directory.** `$(basename $PWD)` uses the working directory name as the project. If the project doesn't exist in clokk, the timer starts without a project.
- **Idempotent stop.** If no timer is running when the session ends, `clokk stop` fails silently rather than showing an error.
- **Tags for attribution.** The `agent,claude-code` tags let developers filter agent-tracked time vs manually-tracked time in reports.

### 18.4 Token-Efficient `usage` Command

The existing `clokk schema` outputs the full citty command schema, which is verbose (~2000+ tokens). For agents using clokk via CLI (not MCP), a more compact discovery mechanism reduces context window consumption.

`clokk usage` outputs a curated, token-efficient summary of all commands in under 1000 tokens — similar to the approach used by [Linearis](https://github.com/czottmann/linearis) which achieves 13x better token efficiency than equivalent MCP tool definitions.

```
clokk usage
```

Returns a compact reference designed for LLM consumption:

```
clokk - time tracker for humans and AI agents

TIMER
  start [desc] -p project -t tags --billable --at time  → start timer
  stop --at time -d desc -t tags                        → stop timer
  switch <desc> -p project -t tags                      → stop + start
  status                                                → current timer
  resume --id entry_id                                  → restart last
  cancel -y                                             → discard timer

ENTRIES
  log [desc] -p project --from time --to time --duration dur -t tags  → add entry
  edit <id> -d desc -p project --from time --to time -t tags          → modify entry
  delete <id> -y                                                      → remove entry
  list -p project -t tags --from --to --today --week --month -n limit → query entries

PROJECTS
  project create <name> -c client --rate n --currency code  → new project
  project list --archived                                   → list projects
  project edit <id> --name --client --rate --currency        → modify project
  project archive <id>                                      → soft-delete
  project delete <id> --force -y                            → hard-delete

REPORTS
  report -p project -t tags --from --to --week --month --group-by key  → time summary
  export --format csv|json -o file -p project --from --to              → export data

CONFIG
  config show    → all settings
  config get <k> → one setting
  config set <k> <v> → update setting

OUTPUT: --json forces JSON; piped output auto-selects JSON.
ERRORS: { ok: false, error: { code, message, suggestions } }
IDS: entries=ent_*, projects=prj_* (use name or ID interchangeably)
DATES: ISO 8601, "2h ago", "yesterday 3pm", "last monday"
DURATIONS: "1h30m", "90m", "1.5h", "1:30:00"
```

This format gives an agent complete knowledge of clokk's interface in a single call, consuming ~600 tokens vs ~2000+ for the full schema.

### 18.5 What clokk already does well for agents

These existing features (implemented in Phases 1–4) form the foundation that the integrations above build on:

| Feature | Spec Section | Status |
|---------|-------------|--------|
| Consistent JSON envelope on all commands | §5.2 | Implemented |
| Structured errors with codes, suggestions, context | §5.4, §10 | Implemented |
| `--json` / `--human` flags + auto-detection | §5.1 | Implemented |
| `--yes` flag for prompt bypass | §6.1, §6.2 | Implemented |
| `clokk schema` — machine-readable command tree | §6.3 | Implemented |
| `clokk commands` — command listing | §6.3 | Implemented |
| Deterministic exit codes (0/1/2) | §10 | Implemented |
| Noun-verb command hierarchy | §6.1 | Implemented |
| ISO 8601 timestamps, integer seconds | §3.1 | Implemented |
| Non-interactive when piped | §6.1 | Implemented |

### 18.6 Anti-patterns avoided

clokk's design deliberately avoids common patterns that make CLI tools hostile to AI agents:

- **No interactive prompts without bypass.** Every confirmation has `--yes` and auto-skips when piped.
- **No human-only output in data fields.** JSON data always uses ISO 8601 and integer seconds, never "2 hours ago" or "1h 30m".
- **No mixed stdout/stderr.** JSON goes to stdout, errors and diagnostics to stderr.
- **No pagers.** Output is never piped through `less` or `more`.
- **No progress bars or spinners in stdout.** Human decorations only appear in TTY human mode.
- **No browser-based auth.** Token-based authentication via `clokk auth login --url --token`.
- **Consistent field naming.** Same field names across all commands (`project_id`, `start_time`, `duration_seconds`).

---

## 19. Non-Goals

Things clokk explicitly does not try to do:

- **Real-time collaboration.** clokk is single-user (with cloud backup). Team features are out of scope.
- **Invoicing.** clokk exports data for invoicing tools. It does not generate invoices.
- **Integrations with project management tools.** No Jira, GitHub, or Asana integration in core. These could be built as separate tools that read clokk's data.
- **Screenshots or activity monitoring.** clokk tracks time, not behavior.
- **Mobile app.** The CLI and TUI are terminal-only. Mobile access can come through the Turso-synced data if needed.
