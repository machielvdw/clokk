import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ClokkError } from "@/core/errors.ts";
import type { Repository } from "@/data/repository.ts";

/**
 * Wraps a core function call and converts the result to an MCP CallToolResult.
 * ClokkErrors are returned as structured error content; unknown errors re-throw.
 */
export async function handleToolCall<T>(fn: () => Promise<T>): Promise<CallToolResult> {
  try {
    const result = await fn();
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  } catch (err) {
    if (err instanceof ClokkError) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: err.code,
              message: err.message,
              suggestions: err.suggestions,
            }),
          },
        ],
        isError: true,
      };
    }
    throw err;
  }
}

/**
 * Resolve a project name or ID to a project ID.
 * Used by tools where the core function expects a resolved project_id
 * (e.g., EntryFilters, ReportFilters, ExportFilters).
 */
export async function resolveProjectId(repo: Repository, nameOrId: string): Promise<string> {
  const project = await repo.getProject(nameOrId);
  return project ? project.id : nameOrId;
}
