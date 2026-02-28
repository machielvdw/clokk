import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Repository } from "@/data/repository.ts";
import {
  logEntry,
  editEntry,
  deleteEntry,
  listEntries,
} from "@/core/entries.ts";
import { handleToolCall, resolveProjectId } from "@/mcp/handle.ts";

export function registerEntryTools(server: McpServer, repo: Repository): void {
  server.registerTool("log_entry", {
    description:
      "Log a completed time entry (not a running timer). " +
      "Requires from; provide either to or duration (in seconds), not both.",
    inputSchema: {
      description: z.string().optional().describe("What you worked on"),
      project: z
        .string()
        .optional()
        .describe(
          "Project name or ID. Use list_projects to find available projects.",
        ),
      from: z.string().describe("Start time in ISO 8601 UTC format"),
      to: z
        .string()
        .optional()
        .describe(
          "End time in ISO 8601 UTC format. Mutually exclusive with duration.",
        ),
      duration: z
        .number()
        .optional()
        .describe("Duration in seconds. Mutually exclusive with to."),
      tags: z
        .array(z.string())
        .optional()
        .describe("Tags to categorize this entry"),
      billable: z.boolean().optional().describe("Mark as billable"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async (input) =>
    handleToolCall(() =>
      logEntry(repo, {
        description: input.description,
        project: input.project,
        from: input.from,
        to: input.to,
        duration: input.duration,
        tags: input.tags,
        billable: input.billable,
      }),
    ),
  );

  server.registerTool("list_entries", {
    description:
      "List time entries with optional filters. " +
      "Returns entries array and total count for pagination. " +
      "Use from/to for date range filtering (ISO 8601 UTC).",
    inputSchema: {
      project: z
        .string()
        .optional()
        .describe("Filter by project name or ID"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Filter by tags (entries matching any tag)"),
      from: z
        .string()
        .optional()
        .describe("Start of date range (ISO 8601 UTC)"),
      to: z
        .string()
        .optional()
        .describe("End of date range (ISO 8601 UTC)"),
      billable: z.boolean().optional().describe("Filter by billable status"),
      running: z
        .boolean()
        .optional()
        .describe(
          "Filter by running status (true = only running, false = only stopped)",
        ),
      limit: z
        .number()
        .optional()
        .describe("Max entries to return (default: 50)"),
      offset: z
        .number()
        .optional()
        .describe("Number of entries to skip for pagination"),
    },
    annotations: { readOnlyHint: true },
  }, async (input) =>
    handleToolCall(async () => {
      const projectId = input.project
        ? await resolveProjectId(repo, input.project)
        : undefined;
      return listEntries(repo, {
        project_id: projectId,
        tags: input.tags,
        from: input.from,
        to: input.to,
        billable: input.billable,
        running: input.running,
        limit: input.limit,
        offset: input.offset,
      });
    }),
  );

  server.registerTool("edit_entry", {
    description:
      "Modify an existing time entry. Only provided fields are updated; omitted fields remain unchanged. " +
      "Use list_entries to find entry IDs.",
    inputSchema: {
      id: z.string().describe("Entry ID (ent_ prefix) to edit"),
      description: z.string().optional().describe("New description"),
      project: z
        .string()
        .optional()
        .describe(
          "New project name or ID. Use list_projects to find available projects.",
        ),
      from: z
        .string()
        .optional()
        .describe("New start time (ISO 8601 UTC)"),
      to: z.string().optional().describe("New end time (ISO 8601 UTC)"),
      tags: z
        .array(z.string())
        .optional()
        .describe("New tags (replaces existing tags)"),
      billable: z.boolean().optional().describe("New billable status"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async (input) =>
    handleToolCall(() =>
      editEntry(repo, input.id, {
        description: input.description,
        project: input.project,
        start_time: input.from,
        end_time: input.to,
        tags: input.tags,
        billable: input.billable,
      }),
    ),
  );

  server.registerTool("delete_entry", {
    description:
      "Permanently delete a time entry. This cannot be undone. " +
      "Use list_entries to find entry IDs.",
    inputSchema: {
      id: z.string().describe("Entry ID (ent_ prefix) to delete"),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  }, async (input) =>
    handleToolCall(() => deleteEntry(repo, input.id)),
  );
}
