# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun test                      # Run all tests
bun test tests/core/timer.test.ts  # Run a single test file
bun tsc --noEmit              # Type check (strict mode)
bunx drizzle-kit generate     # Generate DB migrations after schema changes
bun build ./src/cli/index.ts --compile --outfile dist/clokk  # Compile binary
```

## Architecture

Three-layer architecture. Layers communicate through typed interfaces, never formatted strings or CLI flags.

```
Interface Layer (CLI)  →  parses args, formats output, handles I/O
Core Layer             →  pure business logic, typed in/out, throws typed errors
Data Layer             →  Repository interface with SQLite backend
```

**Core layer rules**: every function takes `(repo: Repository, input?) → Promise<result>`. No awareness of CLI flags, output formatting, or database drivers. Repository is injected, never imported globally.

**Data layer rules**: accessed exclusively through the `Repository` interface (`src/data/repository.ts`). `getProject(idOrName)` resolves both names and IDs by checking the `prj_` prefix. All mutations return the affected object.

## Key Patterns

**Imports**: use `@/` path alias (maps to `src/`) with explicit `.ts` extensions. Named exports only.
```ts
import type { Repository } from "@/data/repository.ts";
import { TimerAlreadyRunningError } from "@/core/errors.ts";
```

**IDs**: prefixed + base36 timestamp + nanoid random suffix. Use `generateEntryId()` / `generateProjectId()` from `src/utils/id.ts`. Check with `isEntryId()` / `isProjectId()`.

**Timestamps**: ISO 8601 UTC strings everywhere. `duration_seconds` is always **computed** from `end_time - start_time`, never stored in the database.

**Database booleans/JSON**: booleans stored as 0/1 integers, tags stored as JSON text. Conversion happens in `toEntry()`/`toProject()` mappers in `src/data/sqlite.ts`.

**Errors**: all extend `ClokkError` with `code` (UPPER_SNAKE_CASE), `message`, `suggestions` (executable commands), `context` (machine-readable), `exitCode` (1=user, 2=system). Defined in `src/core/errors.ts`.

**Testing**: in-memory SQLite with full Drizzle migrations, no mocks. Each test file has its own `createRepo()` helper:
```ts
function createRepo(): Repository {
  const sqlite = new Database(":memory:");
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  return new SqliteRepository(sqlite);
}
```

## Configuration

App data lives at `~/.clokk/` (override with `CLOKK_DIR` env var). Contains `config.json` and `clokk.db` (SQLite, WAL mode). Config system in `src/config.ts`, config business logic in `src/core/config.ts`.

## Spec Reference

`tech_spec.md` is the authoritative specification. Section references (e.g., `§6.3`, `§7`) in `tasks.md` point to specific spec sections. Check the spec before implementing any command or behavior.
