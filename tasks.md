# clokk — Implementation Tasks

Progress is tracked with checkboxes. Each phase is independently testable.

---

## Phase 1: Project Scaffolding

Set up the Bun project, install dependencies, and create the directory structure.

- [x] Initialize Bun project (`bun init`), configure `package.json` (name, bin, scripts)
- [x] Configure `tsconfig.json` (strict mode, paths)
- [x] Install dependencies: `citty`, `drizzle-orm`, `consola`
- [x] Install dev dependencies: `drizzle-kit`, `@types/bun`
- [x] Create directory structure per spec (src/core, src/data, src/cli/commands, tests)
- [x] Add `src/cli/index.ts` entry point with citty command router and all command stubs

**How to test:** `bun run src/cli/index.ts --version` prints the version.

---

## Phase 2: Data Layer — Schema & Repository

Define the database schema and implement the SQLite repository.

- [ ] Define Drizzle schema in `src/data/schema.ts` (projects + entries tables, all indexes)
- [ ] Create `drizzle.config.ts` for drizzle-kit
- [ ] Generate initial migration with `drizzle-kit generate`
- [ ] Implement database initialization in `src/data/db.ts` (ensure `~/.clokk/` dir, create DB, run migrations)
- [ ] Define repository interface in `src/data/repository.ts` (typed CRUD methods)
- [ ] Implement `src/data/sqlite.ts` — SQLite repository (all CRUD for projects + entries)
- [ ] Write integration tests: `tests/data/sqlite.test.ts` (in-memory DB, test all repository methods)

**How to test:** `bun test tests/data/` — all repository CRUD operations pass against an in-memory SQLite DB.

---

## Phase 3: Core Utilities — IDs, Errors, Duration & Date Parsing

Build the shared utilities that every core function depends on.

- [ ] Implement ID generation in `src/core/id.ts` (`prj_` and `ent_` prefixed, base36 timestamp + random)
- [ ] Implement typed error classes in `src/core/errors.ts` (all error codes from spec section 5.4)
- [ ] Implement duration parsing in `src/core/duration.ts` (parse: `"1h30m"`, `"90m"`, `"1.5h"`, `"1:30:00"` → seconds; format: seconds → `"1h 30m"`)
- [ ] Implement date/time parsing in `src/core/date.ts` (parse relative strings like `"2 hours ago"`, `"yesterday 9am"`, ISO 8601, common formats → UTC ISO string)
- [ ] Write unit tests: `tests/core/id.test.ts`, `tests/core/errors.test.ts`, `tests/core/duration.test.ts`, `tests/core/date.test.ts`

**How to test:** `bun test tests/core/` — ID format validation, error codes, duration round-trips, and date parsing all pass.

---

## Phase 4: Core Layer — Timer Operations

Implement the timer lifecycle business logic (start, stop, status, resume, switch, cancel).

- [ ] Implement `src/core/timer.ts` — `startTimer()`: creates entry with `end_time: null`, fails if timer already running
- [ ] Implement `stopTimer()`: sets `end_time` and computes `duration_seconds`, fails if no timer running
- [ ] Implement `getStatus()`: returns running entry with elapsed seconds, or `{ running: false }`
- [ ] Implement `resumeTimer()`: copies description/project/tags from last stopped entry (or specific ID)
- [ ] Implement `switchTimer()`: atomic stop + start in one call
- [ ] Implement `cancelTimer()`: deletes running entry without saving
- [ ] Write unit tests: `tests/core/timer.test.ts` (inject mock repository, test all flows + error cases)

**How to test:** `bun test tests/core/timer.test.ts` — all timer flows pass including error cases (already running, nothing running).

---

## Phase 5: Core Layer — Entry Management

Implement log, edit, delete, list business logic.

- [ ] Implement `src/core/entries.ts` — `logEntry()`: create a completed entry with `--from`/`--to` or `--duration`
- [ ] Implement `editEntry()`: partial update of an existing entry, fails if not found
- [ ] Implement `deleteEntry()`: remove entry by ID, fails if not found
- [ ] Implement `listEntries()`: query with filters (project, tags, date range, billable, running, limit/offset)
- [ ] Write unit tests: `tests/core/entries.test.ts`

**How to test:** `bun test tests/core/entries.test.ts` — log/edit/delete/list with filters all pass.

---

## Phase 6: Core Layer — Project Management

Implement project CRUD business logic.

- [ ] Implement `src/core/projects.ts` — `createProject()`: unique name validation, returns project object
- [ ] Implement `listProjects()`: with optional `--archived` filter
- [ ] Implement `editProject()`: partial update by name or ID
- [ ] Implement `archiveProject()`: soft-delete (set `archived = 1`)
- [ ] Implement `deleteProject()`: hard delete, fail if entries reference it (unless `--force`)
- [ ] Write unit tests: `tests/core/projects.test.ts`

**How to test:** `bun test tests/core/projects.test.ts` — all project CRUD + archive + delete-with-entries scenarios pass.

---

## Phase 7: CLI Infrastructure — Output, Formatting & Command Router

Set up the CLI framework, output detection, JSON envelope, and human formatters.

- [ ] Set up citty main command and subcommand router in `src/cli/index.ts`
- [ ] Implement output format detection in `src/cli/output.ts` (TTY vs piped, `--json`, `--human`, `CLOKK_OUTPUT`, `NO_COLOR`)
- [ ] Implement JSON envelope helpers in `src/cli/output.ts` (`success()` and `error()` wrappers matching spec 5.2)
- [ ] Implement human formatters in `src/cli/format.ts` (duration display, date display, table rendering, colors)
- [ ] Wire up database initialization on CLI startup (ensure DB exists before any command runs)
- [ ] Write tests: `tests/cli/output.test.ts` (envelope shape, format detection logic)

**How to test:** `bun test tests/cli/output.test.ts` — envelope shapes correct; `bun run src/cli/index.ts --help` shows command list.

---

## Phase 8: CLI Commands — Timer

Wire timer core functions to CLI commands.

- [ ] Implement `src/cli/commands/start.ts` — parse args, call `startTimer()`, format output
- [ ] Implement `src/cli/commands/stop.ts`
- [ ] Implement `src/cli/commands/status.ts`
- [ ] Implement `src/cli/commands/resume.ts`
- [ ] Implement `src/cli/commands/switch.ts`
- [ ] Implement `src/cli/commands/cancel.ts`
- [ ] Write CLI integration tests: `tests/cli/timer.test.ts` (spawn process, assert JSON output)

**How to test:** `bun test tests/cli/timer.test.ts` — end-to-end: `clokk start "test"` returns JSON with entry ID, `clokk status` shows running, `clokk stop` returns completed entry.

---

## Phase 9: CLI Commands — Entries

Wire entry management to CLI commands.

- [ ] Implement `src/cli/commands/log.ts`
- [ ] Implement `src/cli/commands/edit.ts`
- [ ] Implement `src/cli/commands/delete.ts`
- [ ] Implement `src/cli/commands/list.ts` (all filter flags)
- [ ] Write CLI integration tests: `tests/cli/entries.test.ts`

**How to test:** `bun test tests/cli/entries.test.ts` — log an entry, list it, edit it, delete it — all via spawned CLI process.

---

## Phase 10: CLI Commands — Projects

Wire project management to CLI commands.

- [ ] Implement `src/cli/commands/project.ts` with subcommands: `create`, `list`, `edit`, `archive`, `delete`
- [ ] Write CLI integration tests: `tests/cli/projects.test.ts`

**How to test:** `bun test tests/cli/projects.test.ts` — create a project, list it, edit it, archive it, delete it.

---

## Phase 11: CLI Commands — Reporting & Export

Implement report generation and data export.

- [ ] Implement `src/core/reports.ts` — `generateReport()`: aggregate entries by group (project/tag/day/week), compute totals + billable amounts
- [ ] Implement `src/core/reports.ts` — `exportEntries()`: serialize entries to CSV or JSON
- [ ] Implement `src/cli/commands/report.ts` (all filter + group-by flags)
- [ ] Implement `src/cli/commands/export.ts` (format, output path, filters)
- [ ] Write tests: `tests/core/reports.test.ts`, `tests/cli/reports.test.ts`

**How to test:** `bun test tests/core/reports.test.ts tests/cli/reports.test.ts` — reports group correctly, CSV export is valid.

---

## Phase 12: CLI Commands — Config & Agent Schema

Implement configuration management and the agent discoverability commands.

- [ ] Implement `src/core/config.ts` — `getConfig()`, `setConfig()`, `showConfig()` (reads/writes `~/.clokk/config.json`, validates keys)
- [ ] Implement `src/cli/commands/config.ts` with subcommands: `show`, `set`, `get`
- [ ] Implement `src/cli/commands/schema.ts` — output full CLI interface as JSON
- [ ] Implement `src/cli/commands/commands.ts` — list all commands with descriptions
- [ ] Write tests: `tests/cli/config.test.ts`, `tests/cli/schema.test.ts`

**How to test:** `bun test tests/cli/config.test.ts tests/cli/schema.test.ts` — config round-trips, schema output matches expected shape.

---

## Phase 13: Agent Workflow End-to-End Tests

Validate the full agent stories from spec Section 9.

- [ ] Write `tests/e2e/agent-workflows.test.ts` — runs through all 9 workflow stories end-to-end via spawned CLI
- [ ] Verify: track a day of work (start → switch → switch → stop)
- [ ] Verify: check status mid-flow
- [ ] Verify: log retroactive entry
- [ ] Verify: generate weekly report
- [ ] Verify: project setup + billing report
- [ ] Verify: edit a mistake
- [ ] Verify: export for invoicing
- [ ] Verify: `clokk schema` returns complete, valid interface definition

**How to test:** `bun test tests/e2e/` — all agent workflow stories pass.

---

## Phase 14: Build & Distribution

Compile and prepare for release.

- [ ] Configure `bun build --compile` in package.json scripts for all targets
- [ ] Set up `package.json` `bin` field for npm global install
- [ ] Test compiled binary runs correctly on current platform
- [ ] Verify `npx clokk` and `bunx clokk` work

**How to test:** Build the binary, run `./clokk start "test" --json`, verify it works without Bun runtime installed.
