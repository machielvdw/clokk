import { defineCommand } from "citty";

const USAGE_TEXT = `clokk - time tracker for humans and AI agents

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
`;

export default defineCommand({
  meta: {
    name: "usage",
    description: "Show compact command reference for AI agents",
  },
  args: {},
  async run() {
    process.stdout.write(USAGE_TEXT);
  },
});
