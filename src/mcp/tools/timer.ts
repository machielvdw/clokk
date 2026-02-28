import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Repository } from "@/data/repository.ts";
import {
  startTimer,
  stopTimer,
  switchTimer,
  getStatus,
  resumeTimer,
  cancelTimer,
} from "@/core/timer.ts";
import { handleToolCall } from "@/mcp/handle.ts";

export function registerTimerTools(server: McpServer, repo: Repository): void {
  server.registerTool("start_timer", {
    description:
      "Start a new time tracking timer. Only one timer can run at a time. " +
      "Use switch_timer to transition between tasks without stopping.",
    inputSchema: {
      description: z.string().optional().describe("What you are working on"),
      project: z
        .string()
        .optional()
        .describe(
          "Project name or ID (prj_ prefix). Use list_projects to find available projects.",
        ),
      tags: z
        .array(z.string())
        .optional()
        .describe("Tags to categorize this entry"),
      billable: z
        .boolean()
        .optional()
        .describe("Mark as billable (defaults to config setting)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async (input) =>
    handleToolCall(() =>
      startTimer(repo, {
        description: input.description,
        project: input.project,
        tags: input.tags,
        billable: input.billable,
      }),
    ),
  );

  server.registerTool("stop_timer", {
    description:
      "Stop the currently running timer. Optionally update the description or tags before stopping.",
    inputSchema: {
      description: z
        .string()
        .optional()
        .describe("Update the description before stopping"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Update tags before stopping"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async (input) =>
    handleToolCall(() =>
      stopTimer(repo, {
        description: input.description,
        tags: input.tags,
      }),
    ),
  );

  server.registerTool("switch_timer", {
    description:
      "Atomically stop the current timer and start a new one. " +
      "Preferred over separate stop_timer + start_timer calls for task transitions.",
    inputSchema: {
      description: z.string().describe("What you are switching to"),
      project: z
        .string()
        .optional()
        .describe(
          "Project name or ID for the new timer. Use list_projects to find available projects.",
        ),
      tags: z
        .array(z.string())
        .optional()
        .describe("Tags for the new timer"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async (input) =>
    handleToolCall(() =>
      switchTimer(repo, {
        description: input.description,
        project: input.project,
        tags: input.tags,
      }),
    ),
  );

  server.registerTool("timer_status", {
    description:
      "Check if a timer is currently running. " +
      "Returns the running entry with elapsed seconds, or { running: false }.",
    annotations: { readOnlyHint: true },
  }, async () => handleToolCall(() => getStatus(repo)));

  server.registerTool("resume_timer", {
    description:
      "Start a new timer cloning the description, project, and tags from the most recently stopped entry. " +
      "Optionally specify an entry ID to resume a specific entry instead.",
    inputSchema: {
      id: z
        .string()
        .optional()
        .describe(
          "Entry ID (ent_ prefix) to resume. If omitted, resumes the most recently stopped entry.",
        ),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async (input) =>
    handleToolCall(() => resumeTimer(repo, { id: input.id })),
  );

  server.registerTool("cancel_timer", {
    description:
      "Discard the running timer without saving. The entry is permanently deleted. " +
      "Use this when a timer was started by mistake.",
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  }, async () => handleToolCall(() => cancelTimer(repo)));
}
