import type { Repository } from "@/data/repository.ts";
import type {
  Project,
  NewProject,
  ProjectFilters,
} from "@/core/types.ts";
import {
  ProjectAlreadyExistsError,
  ProjectNotFoundError,
} from "@/core/errors.ts";
import { generateProjectId } from "@/utils/id.ts";

export async function createProject(
  repo: Repository,
  input: {
    name: string;
    client?: string | null;
    rate?: number | null;
    currency?: string;
    color?: string | null;
  },
): Promise<Project> {
  const existing = await repo.getProject(input.name);
  if (existing) throw new ProjectAlreadyExistsError(input.name);

  const id = generateProjectId();
  const newProject: NewProject = {
    id,
    name: input.name,
    client: input.client,
    color: input.color,
    rate: input.rate,
    currency: input.currency,
  };
  return repo.createProject(newProject);
}

export async function editProject(
  repo: Repository,
  idOrName: string,
  updates: {
    name?: string;
    client?: string | null;
    rate?: number | null;
    currency?: string;
    color?: string | null;
  },
): Promise<Project> {
  const project = await repo.getProject(idOrName);
  if (!project) throw new ProjectNotFoundError(idOrName);

  if (updates.name && updates.name !== project.name) {
    const conflict = await repo.getProject(updates.name);
    if (conflict) throw new ProjectAlreadyExistsError(updates.name);
  }

  return repo.updateProject(project.id, updates);
}

export async function archiveProject(
  repo: Repository,
  idOrName: string,
): Promise<Project> {
  const project = await repo.getProject(idOrName);
  if (!project) throw new ProjectNotFoundError(idOrName);

  return repo.updateProject(project.id, { archived: true });
}

export async function deleteProject(
  repo: Repository,
  idOrName: string,
  opts: { force?: boolean } = {},
): Promise<Project> {
  const project = await repo.getProject(idOrName);
  if (!project) throw new ProjectNotFoundError(idOrName);

  return repo.deleteProject(project.id, opts);
}

export async function listProjects(
  repo: Repository,
  filters: ProjectFilters = {},
): Promise<Project[]> {
  return repo.listProjects(filters);
}
