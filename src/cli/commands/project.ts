import { defineCommand } from "citty";
import { getContext } from "@/cli/context.ts";
import { createProject, listProjects, editProject, archiveProject, deleteProject } from "@/core/projects.ts";
import { confirmAction } from "@/cli/confirm.ts";
import { success } from "@/cli/output.ts";
import { formatProject } from "@/cli/format.ts";
import type { Project } from "@/core/types.ts";

export default defineCommand({
  meta: {
    name: "project",
    description: "Manage projects",
  },
  args: {},
  subCommands: {
    create: defineCommand({
      meta: { name: "create", description: "Create a new project" },
      args: {
        name: {
          type: "positional",
          description: "Project name",
          required: true,
        },
        client: {
          type: "string",
          alias: "c",
          description: "Client name",
        },
        rate: {
          type: "string",
          description: "Hourly rate",
        },
        currency: {
          type: "string",
          description: "Currency code (default: USD)",
        },
        color: {
          type: "string",
          description: "Hex color code",
        },
      },
      async run({ args }) {
        const { repo } = getContext();
        const project = await createProject(repo, {
          name: args.name,
          client: args.client,
          rate: args.rate ? parseFloat(args.rate) : undefined,
          currency: args.currency,
          color: args.color,
        });
        success(project, "Project created.", (d) => formatProject(d as Project));
      },
    }),
    list: defineCommand({
      meta: { name: "list", description: "List all projects" },
      args: {
        archived: {
          type: "boolean",
          description: "Include archived projects",
        },
      },
      async run({ args }) {
        const { repo } = getContext();
        const projects = await listProjects(repo, {
          include_archived: args.archived,
        });
        success(projects, `${projects.length} project(s).`, (d) => {
          const ps = d as Project[];
          if (ps.length === 0) return "  No projects found.";
          return ps.map((p) => formatProject(p)).join("\n\n");
        });
      },
    }),
    edit: defineCommand({
      meta: { name: "edit", description: "Edit a project" },
      args: {
        nameOrId: {
          type: "positional",
          description: "Project name or ID",
          required: true,
        },
        name: {
          type: "string",
          description: "New project name",
        },
        client: {
          type: "string",
          description: "New client name",
        },
        rate: {
          type: "string",
          description: "New hourly rate",
        },
        currency: {
          type: "string",
          description: "New currency code",
        },
        color: {
          type: "string",
          description: "New hex color code",
        },
      },
      async run({ args }) {
        const { repo } = getContext();
        const project = await editProject(repo, args.nameOrId, {
          name: args.name,
          client: args.client,
          rate: args.rate ? parseFloat(args.rate) : undefined,
          currency: args.currency,
          color: args.color,
        });
        success(project, "Project updated.", (d) => formatProject(d as Project));
      },
    }),
    archive: defineCommand({
      meta: { name: "archive", description: "Archive a project" },
      args: {
        nameOrId: {
          type: "positional",
          description: "Project name or ID",
          required: true,
        },
      },
      async run({ args }) {
        const { repo } = getContext();
        const project = await archiveProject(repo, args.nameOrId);
        success(project, "Project archived.", (d) => formatProject(d as Project));
      },
    }),
    delete: defineCommand({
      meta: { name: "delete", description: "Delete a project" },
      args: {
        nameOrId: {
          type: "positional",
          description: "Project name or ID",
          required: true,
        },
        force: {
          type: "boolean",
          description: "Force delete even if entries reference this project",
        },
        yes: {
          type: "boolean",
          alias: "y",
          description: "Skip confirmation prompt",
        },
      },
      async run({ args }) {
        const confirmed = await confirmAction(
          `Delete project "${args.nameOrId}"?`,
          { yes: args.yes },
        );
        if (!confirmed) {
          process.exit(0);
        }
        const { repo } = getContext();
        const project = await deleteProject(repo, args.nameOrId, {
          force: args.force,
        });
        success(project, "Project deleted.", (d) => formatProject(d as Project));
      },
    }),
  },
});
