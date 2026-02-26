# clokk — Development Tasks

> Ordered checklist for building clokk from the ground up. Each phase builds on the previous one. Tick tasks off as you go.
>
> Reference: [tech_spec.md](./tech_spec.md)

---

## Phase 0: Project Foundation

**Goal:** Compilable project with config files, shared utilities, types, and interfaces in place. `bun tsc --noEmit` passes. Utility tests pass.

### Setup

- [ ] **0.1 — Project configuration files** `§2, §2.1, §4`
  - `package.json` — name `clokk`, type `module`, bin field, pinned deps (`citty`, `consola`, `drizzle-orm`, `dayjs`, `nanoid`), dev deps (`typescript`, `@types/bun`, `drizzle-kit`), scripts (`test`, `build`, `db:generate`, `db:migrate`)
  - `tsconfig.json` — strict, ESNext, bundler module resolution, path alias `@/` → `src/`
  - `drizzle.config.ts` — schema `./src/data/schema.ts`, out `./drizzle`, dialect `sqlite`
  - `.gitignore` — node_modules, `*.db`, `.clokk/`, dist/, coverage

### Shared Utilities *(parallel after 0.1)*

- [ ] **0.2 — ID generation** `§13`
  - `src/utils/id.ts` — `generateId(prefix)`, `generateEntryId()`, `generateProjectId()`, `isEntryId()`, `isProjectId()`
  - `tests/utils/id.test.ts` — format validation, uniqueness, prefix correctness

- [ ] **0.3 — Duration parsing & formatting** `§11`
  - `src/utils/duration.ts` — `parseDuration(input): number` (seconds), `formatDuration(seconds): string`
  - `tests/utils/duration.test.ts` — all input formats from spec table, edge cases (0, negative, invalid)

- [ ] **0.4 — Date parsing & formatting** `§12`
  - `src/utils/date.ts` — `parseDate(input): string` (ISO 8601 UTC), `formatDate(iso, format?): string`
  - Uses `dayjs` + custom relative parser (~50 lines of pattern matching)
  - `tests/utils/date.test.ts` — all input formats from spec table, inject `now` for determinism

- [ ] **0.5 — Typed error classes** `§5.4, §10`
  - `src/core/errors.ts` — base `ClokkError` (code, message, suggestions, context, exitCode) + subclass per error code: `TimerAlreadyRunningError`, `NoTimerRunningError`, `EntryNotFoundError`, `ProjectNotFoundError`, `ProjectAlreadyExistsError`, `ProjectHasEntriesError`, `ValidationError`, `ConflictError`, `NoEntriesFoundError`, `ConfigKeyUnknownError`, `ConfigValueInvalidError`, `DatabaseError`
  - `tests/core/errors.test.ts` — correct codes, exitCodes, instanceof, suggestions/context population

### Types & Interfaces *(after 0.5, parallel with each other)*

- [ ] **0.6 — Core type definitions** `§3.1, §3.4, §7`
  - `src/core/types.ts` — `Entry`, `Project`, `NewEntry`, `EntryUpdates`, `EntryFilters`, `NewProject`, `ProjectUpdates`, `ProjectFilters`, `ReportFilters`, `StartTimerInput`, `StopTimerInput`, `SwitchTimerInput`, `LogEntryInput`, etc.
  - `duration_seconds` is on the `Entry` type (computed, not stored) — null when timer is running

- [ ] **0.7 — Repository interface** `§3.4, §3.5`
  - `src/data/repository.ts` — `Repository` interface with all methods from spec §3.4
  - All methods async, imports types from `src/core/types.ts`

---

## Phase 1: Data Layer

**Goal:** Working SQLite-backed repository. Schema defined, migrations generated, all repository methods integration-tested against in-memory SQLite.

**Depends on:** Phase 0 complete.

- [ ] **1.1 — Drizzle schema** `§7`
  - `src/data/schema.ts` — `projects` and `entries` tables with all columns, constraints, defaults, FK (`entries.project_id` → `projects.id` ON DELETE SET NULL)
  - Indexes: `idx_entries_start`, `idx_entries_project`, `idx_entries_end`, `idx_projects_name`
  - Generate initial migration with `drizzle-kit generate`
  - `tests/data/schema.test.ts` — verify schema with in-memory DB insert/select round-trip

- [ ] **1.2 — SQLite repository implementation** `§3.3, §3.4, §7`
  - `src/data/sqlite.ts` — `SqliteRepository` class implementing `Repository`
  - Key behaviors: `getProject` resolves name vs ID by `prj_` prefix, tags serialize as JSON, `duration_seconds` computed on row mapping, `deleteProject` checks for referencing entries
  - `tests/data/sqlite.test.ts` — comprehensive integration suite:
    - Entry CRUD, filtering (project/tags/date range/billable/running), pagination
    - `getRunningEntry` finds `end_time IS NULL`
    - Project CRUD, unique name constraint, archive, force-delete cascading SET NULL
    - `duration_seconds` computation, tag round-trip, `updated_at` mutation

- [ ] **1.3 — Repository factory & config system** `§3.5, §8`
  - `src/data/factory.ts` — `createRepository(config): Repository`, creates DB, runs migrations, enables WAL + foreign keys
  - `src/config.ts` — `ClokkConfig` type, `loadConfig()`, `saveConfig()`, `getConfigDir()`, `getDbPath()`, `ensureConfigDir()`
  - Directory initialization: creates `~/.clokk/` (or `$CLOKK_DIR`) with default `config.json` on first run
  - `tests/data/factory.test.ts` — factory returns working repository
  - `tests/config.test.ts` — loads defaults, merges file values, respects `CLOKK_DIR`

---

## Phase 2: Core Layer

**Goal:** All business logic implemented and unit-tested. Pure functions: repository in, typed result out, typed errors thrown. No I/O, no formatting.

**Depends on:** Phase 1 complete. *(All tasks in this phase can run in parallel.)*

- [ ] **2.1 — Timer functions** `§6.3 Timer Lifecycle`
  - `src/core/timer.ts` — `startTimer`, `stopTimer`, `getStatus`, `resumeTimer`, `switchTimer`, `cancelTimer`
  - `startTimer`: check no running timer, verify project exists if given, generate ID, create entry with `end_time: null`
  - `stopTimer`: get running entry, set `end_time`, optionally update description/tags
  - `getStatus`: return running entry + `elapsed_seconds`, or `{ running: false }`
  - `resumeTimer`: clone last stopped entry (or specific ID) into new running entry
  - `switchTimer`: atomic stop + start, returns `{ stopped, started }`
  - `cancelTimer`: delete running entry
  - `tests/core/timer.test.ts` — start/stop/status/resume/switch/cancel success paths + all error conditions (already running, no timer, project not found)

- [ ] **2.2 — Entry management functions** `§6.3 Entry Management`
  - `src/core/entries.ts` — `logEntry`, `editEntry`, `deleteEntry`, `listEntries`
  - `logEntry`: validate `from` required, `to`/`duration` mutually exclusive, compute `end_time` from duration if needed, verify `end > start`
  - `editEntry`: verify entry exists, validate time range if changed, verify project if changed
  - `tests/core/entries.test.ts` — log with `to` vs `duration`, mutual exclusion error, edit fields, delete, list with filters + pagination

- [ ] **2.3 — Project management functions** `§6.3 Project Management`
  - `src/core/projects.ts` — `createProject`, `editProject`, `archiveProject`, `deleteProject`, `listProjects`
  - Name uniqueness check on create and rename
  - `tests/core/projects.test.ts` — CRUD, duplicate name errors, archive flag, force-delete, list with/without archived

- [ ] **2.4 — Report & export functions** `§6.3 Reporting`
  - `src/core/reports.ts` — `generateReport`, `exportEntries`
  - `generateReport`: group entries by project/tag/day/week, sum durations, compute billable amounts from project rates
  - `exportEntries`: format as CSV or JSON string
  - `tests/core/reports.test.ts` — grouping correctness, billable calculation, empty results, CSV/JSON format validation

- [ ] **2.5 — Config functions** `§6.3 Configuration, §8`
  - `src/core/config.ts` — `showConfig`, `getConfigValue`, `setConfigValue`
  - Validate key existence (`ConfigKeyUnknownError`) and value types (`ConfigValueInvalidError`)
  - `tests/core/config.test.ts` — get/set valid keys, unknown key error, invalid value type error

---

## Phase 3: CLI Interface Layer

**Goal:** All commands wired up and working. TTY/JSON detection works. Integration tests validate the full pipeline by spawning the process and asserting on JSON output.

**Depends on:** Phase 2 complete.

### Output & Parsing *(parallel with each other)*

- [ ] **3.1 — Output system** `§5, §5.1, §5.2, §5.3`
  - `src/cli/output.ts` — `detectOutputMode(): 'json' | 'human'`, `success(data, message)`, `error(err: ClokkError)`, exit code handling (0/1/2)
  - `src/cli/format.ts` — `formatEntry`, `formatProject`, `formatEntryTable`, `formatReport` (human-readable with consola, respects `NO_COLOR`)
  - `tests/cli/output.test.ts` — JSON envelope correctness, format detection logic (TTY → human, piped → JSON, `--json` override, `CLOKK_OUTPUT` env)

- [ ] **3.2 — Input parsing** `§6.1, §6.2, §11, §12`
  - `src/cli/parse.ts` — `parseTags(input): string[]`, `parseDateArg(input): string`, `parseDurationArg(input): number`, `resolveDateShortcuts(args): { from, to }` (converts `--today`/`--week`/`--month` to date ranges)
  - `tests/cli/parse.test.ts` — tag formats (comma/space/mixed), date shortcuts produce correct ranges

### Entry Point *(after 3.1 + 3.2)*

- [ ] **3.3 — CLI entry point & command router** `§4, §6.2`
  - `src/cli/index.ts` — root citty command with global flags (`--json`, `--human`, `--yes`, `--version`, `--help`), register all subcommands, setup hook (ensureConfigDir → loadConfig → createRepository), error boundary (catch `ClokkError` → format)
  - `tests/cli/index.test.ts` — `--version` prints version, `--help` shows help, unknown command errors

### Commands *(all parallel after 3.3)*

- [ ] **3.4 — Timer commands** `§6.3 Timer Lifecycle`
  - `src/cli/commands/start.ts`, `stop.ts`, `status.ts`, `resume.ts`, `switch.ts`, `cancel.ts`
  - Each: define citty args/flags per spec → parse input → call core → format output
  - `cancel` prompts for confirmation in TTY mode (auto-confirm when piped or `--yes`)
  - `tests/cli/timer.test.ts` — spawn process, assert JSON envelopes for each command

- [ ] **3.5 — Entry management commands** `§6.3 Entry Management`
  - `src/cli/commands/log.ts`, `edit.ts`, `delete.ts`, `list.ts`
  - `log`: handle `--to`/`--duration` mutual exclusion
  - `delete`: confirmation prompt
  - `tests/cli/entries.test.ts` — spawn process, assert JSON for log/edit/delete/list

- [ ] **3.6 — Project commands** `§6.3 Project Management`
  - `src/cli/commands/project.ts` — citty command with subcommands: create, list, edit, archive, delete
  - `tests/cli/project.test.ts` — spawn process, assert JSON for each subcommand

- [ ] **3.7 — Report & export commands** `§6.3 Reporting`
  - `src/cli/commands/report.ts`, `export.ts`
  - `report`: date range shortcuts + `--group-by`
  - `export`: format selection, file output or stdout
  - `tests/cli/report.test.ts` — spawn process, assert JSON for report; verify CSV export output

- [ ] **3.8 — Config, schema & commands commands** `§6.3 Configuration, §6.3 Agent Discoverability`
  - `src/cli/commands/config.ts` — subcommands: show, get, set
  - `src/cli/commands/schema.ts` — outputs complete CLI interface as JSON (built from citty command definitions)
  - `src/cli/commands/commands.ts` — lists all commands with descriptions
  - `tests/cli/config.test.ts` — spawn process, assert JSON for config show/get/set, schema output, commands list

---

## Phase 4: Integration & Polish

**Goal:** End-to-end workflow tests pass. First-run experience works. Binary compiles. Ready for use.

**Depends on:** Phase 3 complete. *(All tasks can run in parallel.)*

- [ ] **4.1 — Agent workflow tests** `§9, §17`
  - `tests/workflows/agent.test.ts` — run workflow stories §9.1–§9.9 as end-to-end tests (spawn `clokk` processes in sequence, assert JSON, use temp `CLOKK_DIR`)
  - Validates that an agent could execute every workflow using only `clokk schema` output

- [ ] **4.2 — First-run experience** `§8`
  - `tests/integration/first-run.test.ts` — fresh `CLOKK_DIR` creates dir + config + DB on first command, subsequent runs reuse, env var override works

- [ ] **4.3 — Binary compilation** `§14`
  - Verify `bun build --compile` produces working binary
  - Smoke test compiled binary with basic commands

---

## Future Work *(not part of initial build)*

- [ ] **F.1 — Turso repository adapter** `§15`
  - `src/data/turso.ts` — `TursoRepository` with libsql embedded replicas
  - `clokk sync` command, `clokk auth login` flow

- [ ] **F.2 — TUI interface** `§16`
  - `src/tui/` — Ink-based terminal UI consuming core layer
  - Live timer display, interactive selection, keyboard shortcuts

- [ ] **F.3 — CI/CD pipeline** `§17`
  - GitHub Actions: lint (`tsc --noEmit`) → test (`bun test`) → build (`bun build --compile`) → release (multi-platform binaries, npm publish)

- [ ] **F.4 — Distribution** `§14`
  - Homebrew tap, npm publish config, GitHub Release automation

---

## Dependency Graph

```
Phase 0 ─ Foundation
  0.1 Config
   ├─ 0.2 ID Gen ─────────┐
   ├─ 0.3 Duration Parse ──┤
   ├─ 0.4 Date Parse ──────┼─→ 0.6 Types ─→ 0.7 Repo Interface
   └─ 0.5 Error Classes ──┘
                                       │
Phase 1 ─ Data Layer                   ▼
  1.1 Schema ─→ 1.2 SQLite Repo ─→ 1.3 Factory + Config
                                       │
Phase 2 ─ Core Layer                   ▼
  2.1 Timer ──┐
  2.2 Entries ┤
  2.3 Projects┼─→ (all parallel)
  2.4 Reports ┤
  2.5 Config ─┘
                │
Phase 3 ─ CLI   ▼
  3.1 Output ─┐
  3.2 Parse ──┼─→ 3.3 Entry Point ─→ 3.4–3.8 Commands (all parallel)
              │
Phase 4 ─ Integration
  4.1 Workflow Tests ─┐
  4.2 First-Run Test ─┼─→ (all parallel)
  4.3 Binary Build ───┘
```

## Task Summary

| Phase | Tasks | Description |
|---|---|---|
| Phase 0 | 7 | Config, utilities, types, interfaces |
| Phase 1 | 3 | Schema, SQLite repository, factory |
| Phase 2 | 5 | Business logic (timer, entries, projects, reports, config) |
| Phase 3 | 8 | Output system, input parsing, CLI entry point, all commands |
| Phase 4 | 3 | E2E tests, first-run, binary compilation |
| **Total** | **26** | |
| Future | 4 | Turso, TUI, CI/CD, distribution |
