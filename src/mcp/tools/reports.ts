import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { exportEntries, generateReport } from "@/core/reports.ts";
import type { Repository } from "@/data/repository.ts";
import { handleToolCall, resolveProjectId } from "@/mcp/handle.ts";

export function registerReportTools(server: McpServer, repo: Repository): void {
  server.registerTool(
    "generate_report",
    {
      description:
        "Generate a time report grouped by project, tag, day, or week. " +
        "Returns groups with total seconds, billable amounts, and entry counts. " +
        "Use from/to for date range (ISO 8601 UTC).",
      inputSchema: {
        project: z.string().optional().describe("Filter by project name or ID"),
        tags: z.array(z.string()).optional().describe("Filter by tags"),
        from: z.string().optional().describe("Start of date range (ISO 8601 UTC)"),
        to: z.string().optional().describe("End of date range (ISO 8601 UTC)"),
        group_by: z
          .enum(["project", "tag", "day", "week"])
          .optional()
          .describe("How to group entries (default: project)"),
      },
      annotations: { readOnlyHint: true },
    },
    async (input) =>
      handleToolCall(async () => {
        const projectId = input.project ? await resolveProjectId(repo, input.project) : undefined;
        return generateReport(repo, {
          project_id: projectId,
          tags: input.tags,
          from: input.from,
          to: input.to,
          group_by: input.group_by,
        });
      }),
  );

  server.registerTool(
    "export_entries",
    {
      description:
        "Export time entries as CSV or JSON string. Returns the formatted data directly. " +
        "Use from/to for date range filtering (ISO 8601 UTC).",
      inputSchema: {
        format: z.enum(["csv", "json"]).optional().describe("Export format (default: csv)"),
        project: z.string().optional().describe("Filter by project name or ID"),
        from: z.string().optional().describe("Start of date range (ISO 8601 UTC)"),
        to: z.string().optional().describe("End of date range (ISO 8601 UTC)"),
      },
      annotations: { readOnlyHint: true },
    },
    async (input) =>
      handleToolCall(async () => {
        const projectId = input.project ? await resolveProjectId(repo, input.project) : undefined;
        return exportEntries(repo, {
          project_id: projectId,
          from: input.from,
          to: input.to,
          format: input.format,
        });
      }),
  );
}
