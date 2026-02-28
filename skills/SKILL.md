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
