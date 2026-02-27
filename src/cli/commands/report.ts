import { defineCommand } from "citty";
import { getContext } from "@/cli/context.ts";
import { generateReport } from "@/core/reports.ts";
import { success } from "@/cli/output.ts";
import { formatReport } from "@/cli/format.ts";
import { parseTags, resolveDateShortcuts } from "@/cli/parse.ts";
import type { ReportFilters, ReportResult } from "@/core/types.ts";

export default defineCommand({
  meta: {
    name: "report",
    description: "Generate a time report",
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
      description: "Report for today",
    },
    yesterday: {
      type: "boolean",
      description: "Report for yesterday",
    },
    week: {
      type: "boolean",
      description: "Report for this week (default)",
    },
    month: {
      type: "boolean",
      description: "Report for this month",
    },
    "group-by": {
      type: "enum",
      options: ["project", "tag", "day", "week"],
      description: "Group entries by (default: project)",
    },
  },
  async run({ args }) {
    const { repo, config } = await getContext();

    // Default to --week when no date range given
    const hasDateArg = args.today || args.yesterday || args.week || args.month || args.from || args.to;
    const dateArgs = hasDateArg ? args : { ...args, week: true };
    const dateRange = resolveDateShortcuts(dateArgs, {
      weekStart: config.week_start,
    });

    // Resolve project name → ID
    let projectId: string | undefined;
    if (args.project) {
      const project = await repo.getProject(args.project);
      if (project) {
        projectId = project.id;
      } else {
        projectId = args.project;
      }
    }

    const filters: ReportFilters = {
      project_id: projectId,
      tags: args.tags ? parseTags(args.tags) : undefined,
      from: dateRange.from,
      to: dateRange.to,
      group_by: (args["group-by"] as ReportFilters["group_by"]) ?? "project",
    };

    const result = await generateReport(repo, filters);
    success(result, "Report generated.", (d) => formatReport(d as ReportResult));
  },
});
