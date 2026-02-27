import { writeFileSync } from "node:fs";
import { defineCommand } from "citty";
import { getContext } from "@/cli/context.ts";
import { exportEntries } from "@/core/reports.ts";
import { success } from "@/cli/output.ts";
import { resolveDateShortcuts } from "@/cli/parse.ts";
import type { ExportFilters } from "@/core/types.ts";

export default defineCommand({
  meta: {
    name: "export",
    description: "Export time entries",
  },
  args: {
    format: {
      type: "enum",
      options: ["csv", "json"],
      description: "Export format (default: csv)",
    },
    output: {
      type: "string",
      alias: "o",
      description: "Output file path (default: stdout)",
    },
    project: {
      type: "string",
      alias: "p",
      description: "Filter by project name or ID",
    },
    from: {
      type: "string",
      description: "Start of date range",
    },
    to: {
      type: "string",
      description: "End of date range",
    },
    week: {
      type: "boolean",
      description: "Export this week's entries",
    },
    month: {
      type: "boolean",
      description: "Export this month's entries",
    },
  },
  async run({ args }) {
    const { repo, config } = await getContext();
    const dateRange = resolveDateShortcuts(args, {
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

    const filters: ExportFilters = {
      project_id: projectId,
      from: dateRange.from,
      to: dateRange.to,
      format: (args.format as ExportFilters["format"]) ?? "csv",
    };

    const result = await exportEntries(repo, filters);

    if (args.output) {
      writeFileSync(args.output, result.data + "\n");
      success(
        { file: args.output, format: result.format, entry_count: result.entry_count },
        `Exported ${result.entry_count} entries to ${args.output}.`,
      );
    } else {
      // Write raw data to stdout (no envelope)
      process.stdout.write(result.data + "\n");
    }
  },
});
