# clokk — Development Tasks

> Ordered checklist for building clokk from the ground up. Each phase builds on the previous one. Tick tasks off as you go.
>
> Reference: [tech_spec.md](./tech_spec.md)

---

## Phase 0: Project Foundation

**Goal:** Compilable project with config files, shared utilities, types, and interfaces in place. `bun tsc --noEmit` passes. Utility tests pass.

### Setup

- [x] **0.1 — Project configuration files** `§2, §2.1, §4`
  - `package.json` — name `clokk`, type `module`, bin field, pinned deps (`citty`, `consola`, `drizzle-orm`, `dayjs`, `nanoid`), dev deps (`typescript`, `@types/bun`, `drizzle-kit`), scripts (`test`, `build`, `db:generate`, `db:migrate`)
  - `tsconfig.json` — strict, ESNext, bundler module resolution, path alias `@/` → `src/`
  - `drizzle.config.ts` — schema `./src/data/schema.ts`, out `./drizzle`, dialect `sqlite`
  - `.gitignore` — node_modules, `*.db`, `.clokk/`, dist/, coverage

### Shared Utilities *(parallel after 0.1)*

- [x] **0.2 — ID generation** `§13`
  - `src/utils/id.ts` — `generateId(prefix)`, `generateEntryId()`, `generateProjectId()`, `isEntryId()`, `isProjectId()`
  - `tests/utils/id.test.ts` — format validation, uniqueness, prefix correctness

- [x] **0.3 — Duration parsing & formatting** `§11`
  - `src/utils/duration.ts` — `parseDuration(input): number` (seconds), `formatDuration(seconds): string`
  - `tests/utils/duration.test.ts` — all input formats from spec table, edge cases (0, negative, invalid)

- [x] **0.4 — Date parsing & formatting** `§12`
  - `src/utils/date.ts` — `parseDate(input): string` (ISO 8601 UTC), `formatDate(iso, format?): string`
  - Uses `dayjs` + custom relative parser (~50 lines of pattern matching)
  - `tests/utils/date.test.ts` — all input formats from spec table, inject `now` for determinism

- [x] **0.5 — Typed error classes** `§5.4, §10`
  - `src/core/errors.ts` — base `ClokkError` (code, message, suggestions, context, exitCode) + subclass per error code: `TimerAlreadyRunningError`, `NoTimerRunningError`, `EntryNotFoundError`, `ProjectNotFoundError`, `ProjectAlreadyExistsError`, `ProjectHasEntriesError`, `ValidationError`, `ConflictError`, `NoEntriesFoundError`, `ConfigKeyUnknownError`, `ConfigValueInvalidError`, `DatabaseError`
  - `tests/core/errors.test.ts` — correct codes, exitCodes, instanceof, suggestions/context population

### Types & Interfaces *(after 0.5, parallel with each other)*

- [x] **0.6 — Core type definitions** `§3.1, §3.4, §7`
  - `src/core/types.ts` — `Entry`, `Project`, `NewEntry`, `EntryUpdates`, `EntryFilters`, `NewProject`, `ProjectUpdates`, `ProjectFilters`, `ReportFilters`, `StartTimerInput`, `StopTimerInput`, `SwitchTimerInput`, `LogEntryInput`, etc.
  - `duration_seconds` is on the `Entry` type (computed, not stored) — null when timer is running

- [x] **0.7 — Repository interface** `§3.4, §3.5`
  - `src/data/repository.ts` — `Repository` interface with all methods from spec §3.4
  - All methods async, imports types from `src/core/types.ts`

---

## Phase 1: Data Layer

**Goal:** Working SQLite-backed repository. Schema defined, migrations generated, all repository methods integration-tested against in-memory SQLite.

**Depends on:** Phase 0 complete.

- [x] **1.1 — Drizzle schema** `§7`
  - `src/data/schema.ts` — `projects` and `entries` tables with all columns, constraints, defaults, FK (`entries.project_id` → `projects.id` ON DELETE SET NULL)
  - Indexes: `idx_entries_start`, `idx_entries_project`, `idx_entries_end`, `idx_projects_name`
  - Generate initial migration with `drizzle-kit generate`
  - `tests/data/schema.test.ts` — verify schema with in-memory DB insert/select round-trip

- [x] **1.2 — SQLite repository implementation** `§3.3, §3.4, §7`
  - `src/data/sqlite.ts` — `SqliteRepository` class implementing `Repository`
  - Key behaviors: `getProject` resolves name vs ID by `prj_` prefix, tags serialize as JSON, `duration_seconds` computed on row mapping, `deleteProject` checks for referencing entries
  - `tests/data/sqlite.test.ts` — comprehensive integration suite:
    - Entry CRUD, filtering (project/tags/date range/billable/running), pagination
    - `getRunningEntry` finds `end_time IS NULL`
    - Project CRUD, unique name constraint, archive, force-delete cascading SET NULL
    - `duration_seconds` computation, tag round-trip, `updated_at` mutation

- [x] **1.3 — Repository factory & config system** `§3.5, §8`
  - `src/data/factory.ts` — `createRepository(config): Repository`, creates DB, runs migrations, enables WAL + foreign keys
  - `src/config.ts` — `ClokkConfig` type, `loadConfig()`, `saveConfig()`, `getConfigDir()`, `getDbPath()`, `ensureConfigDir()`
  - Directory initialization: creates `~/.clokk/` (or `$CLOKK_DIR`) with default `config.json` on first run
  - `tests/data/factory.test.ts` — factory returns working repository
  - `tests/config.test.ts` — loads defaults, merges file values, respects `CLOKK_DIR`

---

## Phase 2: Core Layer

**Goal:** All business logic implemented and unit-tested. Pure functions: repository in, typed result out, typed errors thrown. No I/O, no formatting.

**Depends on:** Phase 1 complete. *(All tasks in this phase can run in parallel.)*

- [x] **2.1 — Timer functions** `§6.3 Timer Lifecycle`
  - `src/core/timer.ts` — `startTimer`, `stopTimer`, `getStatus`, `resumeTimer`, `switchTimer`, `cancelTimer`
  - `startTimer`: check no running timer, verify project exists if given, generate ID, create entry with `end_time: null`
  - `stopTimer`: get running entry, set `end_time`, optionally update description/tags
  - `getStatus`: return running entry + `elapsed_seconds`, or `{ running: false }`
  - `resumeTimer`: clone last stopped entry (or specific ID) into new running entry
  - `switchTimer`: atomic stop + start, returns `{ stopped, started }`
  - `cancelTimer`: delete running entry
  - `tests/core/timer.test.ts` — start/stop/status/resume/switch/cancel success paths + all error conditions (already running, no timer, project not found)

- [x] **2.2 — Entry management functions** `§6.3 Entry Management`
  - `src/core/entries.ts` — `logEntry`, `editEntry`, `deleteEntry`, `listEntries`
  - `logEntry`: validate `from` required, `to`/`duration` mutually exclusive, compute `end_time` from duration if needed, verify `end > start`
  - `editEntry`: verify entry exists, validate time range if changed, verify project if changed
  - `tests/core/entries.test.ts` — log with `to` vs `duration`, mutual exclusion error, edit fields, delete, list with filters + pagination

- [x] **2.3 — Project management functions** `§6.3 Project Management`
  - `src/core/projects.ts` — `createProject`, `editProject`, `archiveProject`, `deleteProject`, `listProjects`
  - Name uniqueness check on create and rename
  - `tests/core/projects.test.ts` — CRUD, duplicate name errors, archive flag, force-delete, list with/without archived

- [x] **2.4 — Report & export functions** `§6.3 Reporting`
  - `src/core/reports.ts` — `generateReport`, `exportEntries`
  - `generateReport`: group entries by project/tag/day/week, sum durations, compute billable amounts from project rates
  - `exportEntries`: format as CSV or JSON string
  - `tests/core/reports.test.ts` — grouping correctness, billable calculation, empty results, CSV/JSON format validation

- [x] **2.5 — Config functions** `§6.3 Configuration, §8`
  - `src/core/config.ts` — `showConfig`, `getConfigValue`, `setConfigValue`
  - Validate key existence (`ConfigKeyUnknownError`) and value types (`ConfigValueInvalidError`)
  - `tests/core/config.test.ts` — get/set valid keys, unknown key error, invalid value type error

---

## Phase 3: CLI Interface Layer

**Goal:** All commands wired up and working. TTY/JSON detection works. Integration tests validate the full pipeline by spawning the process and asserting on JSON output.

**Depends on:** Phase 2 complete.

### Output & Parsing *(parallel with each other)*

- [x] **3.1 — Output system** `§5, §5.1, §5.2, §5.3`
  - `src/cli/output.ts` — `detectOutputMode(): 'json' | 'human'`, `success(data, message)`, `error(err: ClokkError)`, exit code handling (0/1/2)
  - `src/cli/format.ts` — `formatEntry`, `formatProject`, `formatEntryTable`, `formatReport` (human-readable with consola, respects `NO_COLOR`)
  - `tests/cli/output.test.ts` — JSON envelope correctness, format detection logic (TTY → human, piped → JSON, `--json` override, `CLOKK_OUTPUT` env)

- [x] **3.2 — Input parsing** `§6.1, §6.2, §11, §12`
  - `src/cli/parse.ts` — `parseTags(input): string[]`, `parseDateArg(input): string`, `parseDurationArg(input): number`, `resolveDateShortcuts(args): { from, to }` (converts `--today`/`--week`/`--month` to date ranges)
  - `tests/cli/parse.test.ts` — tag formats (comma/space/mixed), date shortcuts produce correct ranges

### Entry Point *(after 3.1 + 3.2)*

- [x] **3.3 — CLI entry point & command router** `§4, §6.2`
  - `src/cli/index.ts` — root citty command with global flags (`--json`, `--human`, `--yes`, `--version`, `--help`), register all subcommands, setup hook (ensureConfigDir → loadConfig → createRepository), error boundary (catch `ClokkError` → format)
  - `tests/cli/index.test.ts` — `--version` prints version, `--help` shows help, unknown command errors

### Commands *(all parallel after 3.3)*

- [x] **3.4 — Timer commands** `§6.3 Timer Lifecycle`
  - `src/cli/commands/start.ts`, `stop.ts`, `status.ts`, `resume.ts`, `switch.ts`, `cancel.ts`
  - Each: define citty args/flags per spec → parse input → call core → format output
  - `cancel` prompts for confirmation in TTY mode (auto-confirm when piped or `--yes`)
  - `tests/cli/timer.test.ts` — spawn process, assert JSON envelopes for each command

- [x] **3.5 — Entry management commands** `§6.3 Entry Management`
  - `src/cli/commands/log.ts`, `edit.ts`, `delete.ts`, `list.ts`
  - `log`: handle `--to`/`--duration` mutual exclusion
  - `delete`: confirmation prompt
  - `tests/cli/entries.test.ts` — spawn process, assert JSON for log/edit/delete/list

- [x] **3.6 — Project commands** `§6.3 Project Management`
  - `src/cli/commands/project.ts` — citty command with subcommands: create, list, edit, archive, delete
  - `tests/cli/project.test.ts` — spawn process, assert JSON for each subcommand

- [x] **3.7 — Report & export commands** `§6.3 Reporting`
  - `src/cli/commands/report.ts`, `export.ts`
  - `report`: date range shortcuts + `--group-by`
  - `export`: format selection, file output or stdout
  - `tests/cli/report.test.ts` — spawn process, assert JSON for report; verify CSV export output

- [x] **3.8 — Config, schema & commands commands** `§6.3 Configuration, §6.3 Agent Discoverability`
  - `src/cli/commands/config.ts` — subcommands: show, get, set
  - `src/cli/commands/schema.ts` — outputs complete CLI interface as JSON (built from citty command definitions)
  - `src/cli/commands/commands.ts` — lists all commands with descriptions
  - `tests/cli/config.test.ts` — spawn process, assert JSON for config show/get/set, schema output, commands list

---

## Phase 4: Integration & Polish

**Goal:** End-to-end workflow tests pass. First-run experience works. Binary compiles. Ready for use.

**Depends on:** Phase 3 complete. *(All tasks can run in parallel.)*

- [x] **4.1 — Agent workflow tests** `§9, §17`
  - `tests/workflows/agent.test.ts` — run workflow stories §9.1–§9.9 as end-to-end tests (spawn `clokk` processes in sequence, assert JSON, use temp `CLOKK_DIR`)
  - Validates that an agent could execute every workflow using only `clokk schema` output

- [x] **4.2 — First-run experience** `§8`
  - `tests/integration/first-run.test.ts` — fresh `CLOKK_DIR` creates dir + config + DB on first command, subsequent runs reuse, env var override works

- [x] **4.3 — Binary compilation** `§14`
  - Verify `bun build --compile` produces working binary
  - Smoke test compiled binary with basic commands

---

## Phase 5: CI/CD & Distribution

**Goal:** Automated CI pipeline on every push, release workflow that produces multi-platform binaries, npm package, and Homebrew formula on tag.

**Depends on:** Phase 4 complete. *(F.3.1 can start immediately; F.3.2–F.3.3 and F.4 after F.3.1.)*

- [x] **F.3.1 — CI workflow** `§17`
  - `.github/workflows/ci.yml` — triggered on push and PR
  - Steps: `oven-sh/setup-bun@v2` → `bun install` → `bun tsc --noEmit` → `bun test` → `bun build --compile` (smoke test)
  - Validates that every push has no type errors, passes tests, and compiles

- [x] **F.3.2 — Release workflow** `§14, §17`
  - `.github/workflows/release.yml` — triggered on `v*` tag push
  - Matrix build: compile for 5 targets (`bun-darwin-x64`, `bun-darwin-arm64`, `bun-linux-x64`, `bun-linux-arm64`, `bun-windows-x64`) using platform-specific runners
  - Upload artifacts → create GitHub Release via `softprops/action-gh-release@v2` with all binaries + `checksums.txt` (SHA256)

- [x] **F.3.3 — npm publish step** `§14`
  - Added npm publish job to release workflow: `npm publish --access public` (via `actions/setup-node@v4`, not `bun publish` which lacks OIDC support)
  - Gated by `vars.NPM_PUBLISH` repository variable; add `files` and `publishConfig` fields to `package.json`

- [x] **F.4.1 — Homebrew tap** `§14`
  - Reference formula at `homebrew/clokk.rb` (user creates `homebrew-tap` repository separately)
  - Formula uses `on_macos`/`on_linux` + `on_arm`/`on_intel` blocks to select platform-specific binary from GitHub Releases

- [x] **F.4.2 — Automated formula updates** `§14`
  - Homebrew job in release workflow computes checksums and pushes updated formula to tap repo
  - Gated by `vars.HOMEBREW_PUBLISH` repository variable + `HOMEBREW_TAP_TOKEN` secret

- [x] **F.4.3 — Install documentation**
  - Updated README with install instructions for all four channels (npm, binary, Homebrew, source)

- [ ] **F.5 — Release pipeline activation** *(manual setup, not code)*
  - Create `machielvdw/homebrew-tap` repo with `Formula/` directory
  - Set repo variables: `NPM_PUBLISH=true`, `HOMEBREW_PUBLISH=true`
  - Add repo secrets: `NPM_TOKEN` (npm access token), `HOMEBREW_TAP_TOKEN` (PAT with repo scope)
  - Bump version in `package.json` + `src/cli/index.ts`, tag `v0.1.0`, push tag to trigger first release
  - Verify: GitHub Release created with 5 binaries + checksums, npm package published, Homebrew formula updated

---

## Phase 6: Accounts & Sync

**Goal:** Cloud sync via Turso embedded replicas. Local-first — works offline, syncs when connected.

**Depends on:** Phase 4 complete. *(Independent of Phase 5.)*

- [x] **F.1.1 — TursoRepository implementation** `§15`
  - `bun add @libsql/client` (v0.17+)
  - `src/data/turso.ts` — `TursoRepository` class implementing `SyncableRepository` interface
  - Uses `@libsql/client` `createClient()` with `url` (local file), `syncUrl`, `authToken`, `syncInterval`
  - Drizzle adapter: `drizzle-orm/libsql` instead of `drizzle-orm/bun-sqlite`
  - Shared `toEntry()`/`toProject()` mappers extracted to `src/data/mappers.ts`

- [x] **F.1.2 — Factory backend selection** `§15`
  - Updated `src/data/factory.ts`: if `config.turso.url` is set → `TursoRepository`; otherwise → `SqliteRepository`
  - Factory is now async (`createRepository` returns `Promise<Repository>`)
  - `getContext()` made async, all 20 command call sites updated with `await`

- [x] **F.1.3 — `clokk sync` command** `§15`
  - `src/cli/commands/sync.ts` — triggers manual `client.sync()`, returns sync status
  - Fails gracefully with `SYNC_NOT_CONFIGURED` error and helpful suggestion if Turso is not configured

- [x] **F.1.4 — `clokk auth` commands** `§15`
  - `src/cli/commands/auth.ts` — subcommands: `login`, `logout`
  - `login`: takes `--url` and `--token` flags, validates URL scheme, writes to config
  - `logout`: removes Turso credentials from config, reverts to local-only mode

- [x] **F.1.5 — Turso tests** `§15, §17`
  - `tests/data/turso.test.ts` — `TursoRepository` against in-memory libsql (47 tests)
  - `tests/core/sync.test.ts` — `triggerSync` guard and `isSyncableRepository` type guard
  - `tests/core/auth.test.ts` — login/logout validation, config mutation
  - `tests/cli/sync.test.ts` — CLI integration tests for sync/auth commands

---

## Phase 7: TUI

**Goal:** Terminal UI for interactive time tracking, built with OpenTUI, consuming the same core layer as the CLI.

**Depends on:** Phase 4 complete. *(Independent of Phases 5 and 6.)*

- [x] **F.2.1 — TUI scaffold & entry point** `§16`
  - `bun add @opentui/core @opentui/solid solid-js`
  - Scaffold `src/tui/` directory: `index.tsx`, `app.tsx`, `components/`, `hooks/`
  - Register `clokk ui` command in CLI router
  - Basic shell: full-screen app with status bar showing keyboard hints

- [x] **F.2.2 — Live timer view** `§16`
  - `src/tui/components/timer.tsx` — displays running timer description + elapsed time
  - `src/tui/hooks/use-timer.ts` — polls `getStatus()` every 200ms, manages timer state
  - Keyboard shortcuts: `s` start (prompts for description), `x` stop, `w` switch, `r` resume, `c` cancel
  - Handles "no timer running" state with prompt to start

- [x] **F.2.3 — Entry list & project picker** `§16`
  - `src/tui/components/entry-list.tsx` — scrollable list of recent entries, `j`/`k` or arrow navigation, pagination
  - `src/tui/components/project-picker.tsx` — overlay for project/tag selection with fuzzy filtering
  - Split-pane layout: timer pane (top/left) + entry list pane (bottom/right) using Flexbox
  - Focus management: Tab cycles between panes

- [x] **F.2.4 — Report visualization** `§16`
  - `src/tui/components/report-view.tsx` — grouped time summaries as ASCII bar charts
  - Date range navigation (day/week/month shortcuts)
  - Toggle between report view and entry list via keyboard

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
              │
              ▼
    ┌─────────┼─────────┐
    │         │         │
Phase 5    Phase 6   Phase 7
CI/CD      Sync      TUI
F.3→F.4    F.1.*     F.2.*
(serial)  (parallel) (parallel)
```

## Task Summary

| Phase | Tasks | Description |
|---|---|---|
| Phase 0 | 7 | Config, utilities, types, interfaces |
| Phase 1 | 3 | Schema, SQLite repository, factory |
| Phase 2 | 5 | Business logic (timer, entries, projects, reports, config) |
| Phase 3 | 8 | Output system, input parsing, CLI entry point, all commands |
| Phase 4 | 3 | E2E tests, first-run, binary compilation |
| **Phases 0–4** | **26** | **Complete** |
| Phase 5 | 6 | CI/CD pipeline, release workflow, npm, Homebrew |
| Phase 6 | 5 | Turso adapter, factory update, sync/auth commands, tests |
| Phase 7 | 4 | OpenTUI scaffold, live timer, entry list, reports |
| **Phases 5–7** | **15** | |
