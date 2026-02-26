# clokk

A local-first CLI time tracker built for humans and AI agents.

## Stack

- **Runtime:** Bun (use `bun` instead of `node`, `bun test` instead of `jest`)
- **CLI Framework:** citty (UnJS) — typed arg definitions, auto-generated help
- **ORM:** Drizzle with bun:sqlite
- **Output:** consola (UnJS) — environment-aware reporters
- **Testing:** bun test (built-in, Jest-compatible)

## Commands

- `bun run dev` — run the CLI in development
- `bun test` — run all tests
- `bun run build` — compile to single binary
- `bun run db:generate` — generate Drizzle migrations
- `bun run db:push` — push schema to database

## Architecture

Three-layer architecture: Interface (CLI) → Core (business logic) → Data (repository).

- **src/core/** — pure business logic, no I/O formatting, takes/returns typed objects
- **src/data/** — Drizzle schema, repository interface, SQLite implementation
- **src/cli/** — citty commands, output formatting, format detection
- **tests/** — mirrors src/ structure (tests/core/, tests/data/, tests/cli/, tests/e2e/)

## Conventions

- All timestamps: ISO 8601 UTC
- All durations: integer seconds internally
- IDs: prefixed (`prj_`, `ent_`) + base36 timestamp + random suffix
- Errors: typed classes with UPPER_SNAKE_CASE codes
- Output: JSON envelope `{ ok, data/error, message }` for piped output, human-formatted for TTY
- Database at `~/.clokk/clokk.db`, config at `~/.clokk/config.json` (override with `CLOKK_DIR`)
