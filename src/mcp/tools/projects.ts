import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createProject, editProject, listProjects } from "@/core/projects.ts";
import type { Repository } from "@/data/repository.ts";
import { handleToolCall } from "@/mcp/handle.ts";

export function registerProjectTools(server: McpServer, repo: Repository): void {
  server.registerTool(
    "create_project",
    {
      description:
        "Create a new project for organizing time entries. " +
        "Project names must be unique. Use list_projects to see existing projects.",
      inputSchema: {
        name: z.string().describe("Project name (must be unique)"),
        client: z.string().optional().describe("Client name associated with this project"),
        rate: z.number().optional().describe("Hourly billing rate"),
        currency: z.string().optional().describe("Currency code for the rate (default: USD)"),
        color: z.string().optional().describe("Hex color code for display (e.g., #FF5733)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) =>
      handleToolCall(() =>
        createProject(repo, {
          name: input.name,
          client: input.client,
          rate: input.rate,
          currency: input.currency,
          color: input.color,
        }),
      ),
  );

  server.registerTool(
    "list_projects",
    {
      description:
        "List all projects. Returns project details including name, client, rate, and color. " +
        "Use the archived flag to include archived projects.",
      inputSchema: {
        archived: z.boolean().optional().describe("Include archived projects (default: false)"),
      },
      annotations: { readOnlyHint: true },
    },
    async (input) => handleToolCall(() => listProjects(repo, { include_archived: input.archived })),
  );

  server.registerTool(
    "edit_project",
    {
      description:
        "Update a project's properties. Only provided fields are updated; omitted fields remain unchanged. " +
        "Use list_projects to find project names or IDs.",
      inputSchema: {
        id: z.string().describe("Project name or ID (prj_ prefix) to edit"),
        name: z.string().optional().describe("New project name (must be unique)"),
        client: z.string().optional().describe("New client name"),
        rate: z.number().optional().describe("New hourly billing rate"),
        currency: z.string().optional().describe("New currency code"),
        color: z.string().optional().describe("New hex color code"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) =>
      handleToolCall(() =>
        editProject(repo, input.id, {
          name: input.name,
          client: input.client,
          rate: input.rate,
          currency: input.currency,
          color: input.color,
        }),
      ),
  );
}
