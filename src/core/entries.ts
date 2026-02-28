import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { EntryNotFoundError, ProjectNotFoundError, ValidationError } from "@/core/errors.ts";
import type {
  Entry,
  EntryFilters,
  EntryUpdates,
  ListEntriesResult,
  LogEntryInput,
} from "@/core/types.ts";
import type { Repository } from "@/data/repository.ts";
import { generateEntryId } from "@/utils/id.ts";

dayjs.extend(utc);

export async function logEntry(repo: Repository, input: LogEntryInput): Promise<Entry> {
  if (input.to && input.duration !== undefined) {
    throw new ValidationError("--to and --duration are mutually exclusive. Use one or the other.");
  }

  if (!input.to && input.duration === undefined) {
    throw new ValidationError("Either --to or --duration is required.");
  }

  let endTime: string;
  if (input.to) {
    endTime = input.to;
  } else {
    endTime = dayjs.utc(input.from).add(input.duration!, "second").toISOString();
  }

  if (!dayjs.utc(endTime).isAfter(dayjs.utc(input.from))) {
    throw new ValidationError("End time must be after start time.", {
      from: input.from,
      to: endTime,
    });
  }

  let projectId: string | null = null;
  if (input.project) {
    const project = await repo.getProject(input.project);
    if (!project) throw new ProjectNotFoundError(input.project);
    projectId = project.id;
  }

  const id = generateEntryId();
  return repo.createEntry({
    id,
    project_id: projectId,
    description: input.description ?? "",
    start_time: input.from,
    end_time: endTime,
    tags: input.tags ?? [],
    billable: input.billable,
  });
}

export async function editEntry(
  repo: Repository,
  id: string,
  updates: {
    description?: string;
    project?: string | null;
    start_time?: string;
    end_time?: string;
    tags?: string[];
    billable?: boolean;
  },
): Promise<Entry> {
  const entry = await repo.getEntry(id);
  if (!entry) throw new EntryNotFoundError(id);

  const repoUpdates: EntryUpdates = {};

  if (updates.description !== undefined) repoUpdates.description = updates.description;
  if (updates.start_time !== undefined) repoUpdates.start_time = updates.start_time;
  if (updates.end_time !== undefined) repoUpdates.end_time = updates.end_time;
  if (updates.tags !== undefined) repoUpdates.tags = updates.tags;
  if (updates.billable !== undefined) repoUpdates.billable = updates.billable;

  if (updates.project !== undefined) {
    if (updates.project === null || updates.project === "") {
      repoUpdates.project_id = null;
    } else {
      const project = await repo.getProject(updates.project);
      if (!project) throw new ProjectNotFoundError(updates.project);
      repoUpdates.project_id = project.id;
    }
  }

  // Validate time range if either time was changed
  const startTime = updates.start_time ?? entry.start_time;
  const endTime = updates.end_time !== undefined ? updates.end_time : entry.end_time;
  if (endTime && !dayjs.utc(endTime).isAfter(dayjs.utc(startTime))) {
    throw new ValidationError("End time must be after start time.", {
      start_time: startTime,
      end_time: endTime,
    });
  }

  return repo.updateEntry(id, repoUpdates);
}

export async function deleteEntry(repo: Repository, id: string): Promise<Entry> {
  const entry = await repo.getEntry(id);
  if (!entry) throw new EntryNotFoundError(id);
  return repo.deleteEntry(id);
}

export async function listEntries(
  repo: Repository,
  filters: EntryFilters = {},
): Promise<ListEntriesResult> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const result = await repo.listEntries({ ...filters, limit, offset });
  return {
    entries: result.entries,
    total: result.total,
    limit,
    offset,
  };
}
