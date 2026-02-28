# CLAUDE.md

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
Interface Layer (CLI + TUI + MCP)  →  parses args / renders UI / exposes MCP tools
Core Layer                         →  pure business logic, typed in/out, throws typed errors
Data Layer                         →  Repository interface with SQLite backend
```

**Core layer**: every function takes `(repo: Repository, input?) → Promise<result>`. No awareness of CLI flags, output formatting, or database drivers. Repository is injected, never imported globally.

**Data layer**: accessed exclusively through the `Repository` interface (`src/data/repository.ts`). `getProject(idOrName)` resolves both names and IDs by checking the `prj_` prefix. All mutations return the affected object.

**CLI layer** (`src/cli/`): each command follows the same pattern — errors propagate to the entry point error boundary, no try/catch in commands:
```ts
async run({ args }) {
  const { repo } = getContext();        // memoized context from src/cli/context.ts
  const result = await coreFunction(repo, parsedInput);
  success(result, "Message.", (d) => formatResult(d as Type));
}
```

**TUI layer** (`src/tui/`): interactive terminal UI using OpenTUI (Zig-native renderer) + SolidJS (fine-grained reactivity). Launched via `clokk ui`. Reuses core/data layers — never imports CLI layer.

- **Entry point**: `src/tui/index.ts` registers the SolidJS Bun plugin (`@opentui/solid/bun-plugin`) before loading any `.tsx` files. JSX lives in `src/tui/render.tsx` and component files.
- **Components**: `src/tui/components/*.tsx` — SolidJS components using OpenTUI JSX elements (`<box>`, `<text>`, `<input>`, `<scrollbox>`).
- **Hooks**: `src/tui/hooks/*.ts` — SolidJS hooks (`createSignal`, `createEffect`, `onCleanup`) for polling core functions. `useRepo()` provides Repository context.
- **Bun plugin requirement**: SolidJS compiles JSX via Babel, not standard `jsx-runtime`. The plugin **must** be registered in a plain `.ts` file before any `.tsx` import. Never put JSX in `index.ts`.
- **Binary compilation**: `src/cli/commands/ui.ts` uses an opaque dynamic import (`const path = "..."; import(path)`) so `bun build --compile` doesn't trace into TUI/SolidJS dependencies.

**MCP layer** (`src/mcp/`): Model Context Protocol server exposing 15 tools over stdio transport. Launched via `clokk mcp serve`. Same architectural pattern as CLI — calls core functions with injected repo.

- **Entry point**: `src/mcp/server.ts` — creates `McpServer`, registers all tools, connects `StdioServerTransport`.
- **Tool files**: `src/mcp/tools/{timer,entries,projects,reports}.ts` — each file registers tools via `server.registerTool()` with Zod input schemas and tool annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`).
- **Error wrapper**: `src/mcp/handle.ts` — `handleToolCall()` converts `ClokkError` to structured `isError: true` responses with `{ error, message, suggestions }`. Unknown errors re-throw.
- **Project resolution**: `resolveProjectId(repo, nameOrId)` in `handle.ts` — used by tools where filters expect a resolved ID (`list_entries`, `generate_report`, `export_entries`). Not needed when core functions resolve internally (`log_entry`, `edit_entry`, `start_timer`).
- **Binary compilation**: `src/cli/commands/mcp.ts` uses the same opaque dynamic import pattern as TUI to avoid bundling MCP SDK.

## Key Patterns

**Imports**: use `@/` path alias (maps to `src/`) with explicit `.ts` extensions (`.tsx` for JSX files). Named exports only.
```ts
import type { Repository } from "@/data/repository.ts";
import { TimerAlreadyRunningError } from "@/core/errors.ts";
import { Timer } from "@/tui/components/timer.tsx";  // .tsx for JSX
```

**IDs**: prefixed + base36 timestamp + nanoid random suffix. Use `generateEntryId()` / `generateProjectId()` from `src/utils/id.ts`. Check with `isEntryId()` / `isProjectId()`.

**Timestamps**: ISO 8601 UTC strings everywhere. `duration_seconds` is always **computed** from `end_time - start_time`, never stored in the database.

**Database booleans/JSON**: booleans stored as 0/1 integers, tags stored as JSON text. Conversion happens in `toEntry()`/`toProject()` mappers in `src/data/sqlite.ts`.

**Errors**: all extend `ClokkError` with `code` (UPPER_SNAKE_CASE), `message`, `suggestions` (executable commands), `context` (machine-readable), `exitCode` (1=user, 2=system). Defined in `src/core/errors.ts`.

**Single timer model**: only one timer can run at a time. `startTimer` throws `TimerAlreadyRunningError` if one exists. Use `switch` for task transitions.

## Testing

**Core/data tests**: in-memory SQLite with full Drizzle migrations, no mocks. Each test file has its own `createRepo()` helper:
```ts
function createRepo(): Repository {
  const sqlite = new Database(":memory:");
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  return new SqliteRepository(sqlite);
}
```

**MCP tests**: in-memory SQLite + `InMemoryTransport.createLinkedPair()` for end-to-end tool invocations without stdio:
```ts
const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
await server.connect(serverTransport);
await client.connect(clientTransport);
const result = await client.callTool({ name: "start_timer", arguments: { description: "Test" } });
```

**CLI integration tests**: spawn real process with isolated temp dir, assert on JSON output:
```ts
const proc = Bun.spawnSync(["bun", "src/cli/index.ts", ...args], {
  cwd: PROJECT_ROOT,
  env: { ...process.env, CLOKK_DIR: tmpDir },
});
```

## Configuration

App data lives at `~/.clokk/` (override with `CLOKK_DIR` env var). Contains `config.json` and `clokk.db` (SQLite, WAL mode). Config system in `src/config.ts`, config business logic in `src/core/config.ts`.

## Spec Reference

`tech_spec.md` is the authoritative specification. Section references (e.g., `§6.3`, `§7`) in `tasks.md` point to specific spec sections. Check the spec before implementing any command or behavior.
