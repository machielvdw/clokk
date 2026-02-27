# clokk

A local-first CLI time tracker built for humans and AI agents.

clokk is a fast, terminal-native time tracker that works equally well when you type commands yourself or when an AI agent (like Claude Code) drives it programmatically. Every command outputs structured JSON when piped, so scripts and agents get predictable, machine-readable data without any extra flags.

## Install

**From source (requires [Bun](https://bun.sh)):**

```bash
git clone https://github.com/<org>/clokk.git
cd clokk
bun install
bun build ./src/cli/index.ts --compile --outfile dist/clokk
# Move dist/clokk somewhere on your PATH
```

## Quick start

```bash
# Start tracking
clokk start "Feature: auth flow" --project acme --tags backend,auth

# Check what's running
clokk status

# Switch tasks (atomic stop + start)
clokk switch "Code review" --project acme --tags review

# Stop the timer
clokk stop

# Log time retroactively
clokk log "Client call" --from "today 2pm" --to "today 3:30pm" --project acme

# See your day
clokk report --today
```

## Commands

### Timer lifecycle

| Command | Description |
|---|---|
| `clokk start [description]` | Start a new timer |
| `clokk stop` | Stop the running timer |
| `clokk status` | Show what's currently running |
| `clokk resume` | Restart the last stopped timer |
| `clokk switch [description]` | Stop current timer and start a new one |
| `clokk cancel` | Discard the running timer |

### Entry management

| Command | Description |
|---|---|
| `clokk log [description]` | Add a completed entry manually |
| `clokk edit <id>` | Modify an existing entry |
| `clokk delete <id>` | Delete an entry |
| `clokk list` | List entries with filtering |

### Projects

| Command | Description |
|---|---|
| `clokk project create <name>` | Create a project |
| `clokk project list` | List projects |
| `clokk project edit <name_or_id>` | Edit a project |
| `clokk project archive <name_or_id>` | Archive a project |
| `clokk project delete <name_or_id>` | Delete a project |

### Reporting & export

| Command | Description |
|---|---|
| `clokk report` | Generate a time report |
| `clokk export` | Export entries to CSV or JSON |

### Configuration

| Command | Description |
|---|---|
| `clokk config show` | Display all settings |
| `clokk config set <key> <value>` | Set a config value |
| `clokk config get <key>` | Get a config value |

### Agent discoverability

| Command | Description |
|---|---|
| `clokk schema` | Output the full CLI interface as JSON |
| `clokk commands` | List all commands with descriptions |

## Output modes

clokk automatically detects how it's being used:

- **TTY** (interactive terminal) — colored, human-friendly tables
- **Piped / redirected** — structured JSON
- `--json` — force JSON output
- `--human` — force human output
- `NO_COLOR` — disable colors

Every JSON response uses a consistent envelope:

```json
{
  "ok": true,
  "data": { "id": "ent_m3kf9xa8b2", "description": "Feature: auth flow", "..." : "..." },
  "message": "Timer started: Feature: auth flow [acme]"
}
```

Errors include machine-readable codes, messages, and actionable suggestions:

```json
{
  "ok": false,
  "error": {
    "code": "TIMER_ALREADY_RUNNING",
    "message": "A timer is already running: \"Bug triage\". Stop it first or use 'clokk switch'.",
    "suggestions": ["clokk stop", "clokk switch \"Feature: auth flow\""]
  }
}
```

## Data storage

All data lives at `~/.clokk/` (override with `CLOKK_DIR` env var):

- `config.json` — user preferences
- `clokk.db` — SQLite database (WAL mode)

No account required. No network calls. Everything stays on your machine.

## Environment variables

| Variable | Description |
|---|---|
| `CLOKK_DIR` | Override the config/data directory (default: `~/.clokk`) |
| `CLOKK_OUTPUT` | Force output format: `json` or `human` |
| `NO_COLOR` | Disable colors in human output |
| `TZ` | Override timezone for display (storage is always UTC) |

## Development

Requires [Bun](https://bun.sh) v1.0+.

```bash
bun install                   # Install dependencies
bun test                      # Run all tests
bun tsc --noEmit              # Type check
bun src/cli/index.ts start    # Run without compiling
```

## Tech stack

- **Runtime:** [Bun](https://bun.sh) — native SQLite, fast startup, TypeScript without a build step
- **CLI framework:** [citty](https://github.com/unjs/citty) — typed arg definitions, auto-generated help
- **Database:** SQLite via `bun:sqlite` — zero-dependency, instant reads/writes
- **ORM:** [Drizzle](https://orm.drizzle.team) — type-safe schema, SQL-like query builder
- **Output:** [consola](https://github.com/unjs/consola) — pluggable reporters, environment auto-detection
