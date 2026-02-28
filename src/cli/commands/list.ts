import { defineCommand } from "citty";
import { getContext } from "@/cli/context.ts";
import { formatEntryTable } from "@/cli/format.ts";
import { success } from "@/cli/output.ts";
import { parseTags, resolveDateShortcuts } from "@/cli/parse.ts";
import { listEntries } from "@/core/entries.ts";
import type { EntryFilters, ListEntriesResult } from "@/core/types.ts";

export default defineCommand({
  meta: {
    name: "list",
    description: "List time entries",
  },
  args: {
    project: {
      type: "string",
      alias: "p",
      description: "Filter by project name or ID",
    },
    tags: {
      type: "string",
      alias: "t",
      description: "Filter by tags (comma-separated)",
    },
    from: {
      type: "string",
      description: "Start of date range",
    },
    to: {
      type: "string",
      description: "End of date range",
    },
    today: {
      type: "boolean",
      description: "Show today's entries",
    },
    yesterday: {
      type: "boolean",
      description: "Show yesterday's entries",
    },
    week: {
      type: "boolean",
      description: "Show this week's entries",
    },
    month: {
      type: "boolean",
      description: "Show this month's entries",
    },
    billable: {
      type: "boolean",
      description: "Filter by billable status",
    },
    running: {
      type: "boolean",
      description: "Show only running entries",
    },
    limit: {
      type: "string",
      alias: "n",
      description: "Max entries to show (default: 50)",
    },
    offset: {
      type: "string",
      description: "Number of entries to skip",
    },
  },
  async run({ args }) {
    const { repo, config } = await getContext();

    // Resolve date shortcuts (--today, --week, etc.) into from/to
    const dateRange = resolveDateShortcuts(args, {
      weekStart: config.week_start,
    });

    // Resolve project name → ID if needed
    let projectId: string | undefined;
    if (args.project) {
      const project = await repo.getProject(args.project);
      if (project) {
        projectId = project.id;
      } else {
        projectId = args.project; // pass through, let core handle error
      }
    }

    const filters: EntryFilters = {
      project_id: projectId,
      tags: args.tags ? parseTags(args.tags) : undefined,
      from: dateRange.from,
      to: dateRange.to,
      billable: args.billable,
      running: args.running,
      limit: args.limit ? parseInt(args.limit, 10) : undefined,
      offset: args.offset ? parseInt(args.offset, 10) : undefined,
    };

    const result = await listEntries(repo, filters);

    // Build project name map for human output
    const projectIds = new Set(
      result.entries.map((e) => e.project_id).filter((id): id is string => id != null),
    );
    const projectNames = new Map<string, string>();
    for (const pid of projectIds) {
      const p = await repo.getProject(pid);
      if (p) projectNames.set(pid, p.name);
    }

    success(result, `${result.entries.length} entries (${result.total} total).`, (d) =>
      formatEntryTable((d as ListEntriesResult).entries, { projectNames }),
    );
  },
});
