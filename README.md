# clokk

A local-first CLI time tracker designed for AI agents and humans alike.

clokk is a terminal-native time tracker built from the ground up to be driven by AI coding agents. It works equally well when you type commands or when an agent like Claude Code, Cursor, or OpenClaw drives it programmatically. Every command auto-detects its context — structured JSON when piped, human-friendly output in a terminal — so agents get predictable, machine-readable data without any extra flags.

**Four ways to integrate with AI agents:**

- **MCP Server** — 15 typed tools over Model Context Protocol (Claude Code, Cursor, OpenClaw)
- **CLI** — structured JSON output, `--json` flag, `--yes` for non-interactive use
- **Claude Code Hooks** — automatic time tracking on session start/stop
- **Agent Skill** — [AgentSkills](https://skills.sh/) standard for cross-agent discovery

## Install

### npm (requires [Bun](https://bun.sh))

```bash
npm install -g clokk

# Or run directly
bunx clokk start "working"
npx clokk start "working"
```

### Download binary (no runtime needed)

Pre-compiled binaries for macOS, Linux, and Windows:

```bash
# macOS / Linux
curl -fsSL https://github.com/machielvdw/clokk/releases/latest/download/clokk-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/aarch64/arm64/;s/x86_64/x64/') -o clokk
chmod +x clokk
sudo mv clokk /usr/local/bin/
```

Or download manually from [Releases](https://github.com/machielvdw/clokk/releases/latest).

### Homebrew (macOS / Linux)

```bash
brew tap machielvdw/tap
brew install clokk
```

### From source

```bash
git clone https://github.com/machielvdw/clokk.git
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

## AI agent integration

clokk provides first-class support for AI coding agents. No LLM has training data about clokk, so it ships with multiple self-describing interfaces that agents can discover at runtime.

### MCP Server (recommended)

The MCP server exposes 15 typed tools that MCP-compatible hosts invoke directly — no CLI parsing needed.

Add a `.mcp.json` to your project root:

```json
{
  "mcpServers": {
    "clokk": {
      "command": "clokk",
      "args": ["mcp", "serve"]
    }
  }
}
```

Tools: `start_timer`, `stop_timer`, `switch_timer`, `timer_status`, `resume_timer`, `cancel_timer`, `log_entry`, `list_entries`, `edit_entry`, `delete_entry`, `create_project`, `list_projects`, `edit_project`, `generate_report`, `export_entries`

Each tool has typed input schemas, descriptions, and annotations (`readOnlyHint`, `destructiveHint`) so the agent knows what's safe to call autonomously.

### CLI integration

Every command outputs structured JSON when piped or when `--json` is passed. Agents can use clokk's CLI directly:

```bash
# Start tracking (agent gets back entry ID, timestamps, etc.)
clokk start "Feature: auth flow" --project acme --tags backend --json

# Check status
clokk status --json

# Switch tasks atomically
clokk switch "Code review" --project acme --json

# Query entries
clokk list --today --json
```

Self-describing commands for runtime discovery:

| Command | Description |
|---|---|
| `clokk usage` | Compact command reference (~600 tokens) — ideal for LLM context |
| `clokk schema` | Full CLI schema as JSON — every command, flag, and type |
| `clokk commands --json` | List all commands with descriptions |

### Automatic time tracking (Claude Code hooks)

Add to `~/.claude/settings.json` to track time automatically during coding sessions:

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

- **Project from directory**: uses `$(basename $PWD)` as the project name
- **Fail silently**: hooks never block the agent (errors suppressed with `2>/dev/null || true`)
- **Tags for filtering**: `clokk report --tags agent --week --json` to see agent-tracked time

### Agent Skill

clokk ships a [SKILL.md](skills/SKILL.md) following the [AgentSkills](https://skills.sh/) open standard. Compatible with Claude Code, OpenClaw, Cursor, and other agents that support the standard.

### Design for agents

clokk avoids common patterns that make CLI tools hostile to AI agents:

- **No interactive prompts without bypass** — every confirmation has `--yes` and auto-skips when piped
- **No human-only data fields** — JSON always uses ISO 8601 timestamps and integer seconds, never relative formats
- **No mixed stdout/stderr** — JSON to stdout, diagnostics to stderr
- **No pagers or spinners in stdout** — decorations only in TTY human mode
- **Consistent field naming** — same names across all commands (`project_id`, `start_time`, `duration_seconds`)
- **Structured errors** — machine-readable `code`, `message`, and `suggestions` (executable commands)
- **Deterministic exit codes** — `0` success, `1` user error, `2` system error

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

### Sync & auth

| Command | Description |
|---|---|
| `clokk sync` | Trigger a manual sync with Turso |
| `clokk auth login` | Authenticate with the sync service |
| `clokk auth logout` | Log out and clear credentials |

### Interactive UI

| Command | Description |
|---|---|
| `clokk ui` | Launch the interactive terminal UI |

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

## Interactive terminal UI

`clokk ui` launches a full-screen interactive interface for managing timers, viewing entries, and generating reports — all without leaving the terminal.

```bash
clokk ui
```

### Keyboard shortcuts

| Key | Action |
|---|---|
| `s` | Start a new timer |
| `x` | Stop the running timer |
| `w` | Switch to a new task |
| `r` | Resume the last timer |
| `c` | Cancel the running timer |
| `Tab` | Toggle focus between timer and entry list |
| `j` / `k` | Navigate entries |
| `n` / `N` | Next / previous page |
| `R` | Toggle report view |
| `?` | Show all shortcuts |
| `q` | Quit |

In report view: `d`/`w`/`m` set period (day/week/month), `h`/`l` navigate periods, `g` cycle grouping, `t` reset to today.

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
- **MCP:** [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) — typed tool definitions with Zod schemas
- **TUI:** [OpenTUI](https://github.com/anomalyco/opentui) + [SolidJS](https://www.solidjs.com) — Zig-native terminal rendering with fine-grained reactivity
