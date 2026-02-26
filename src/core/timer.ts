import type { Repository } from "@/data/repository.ts";
import type {
  Entry,
  StartTimerInput,
  StopTimerInput,
  ResumeTimerInput,
  SwitchTimerInput,
  StatusResult,
  SwitchResult,
} from "@/core/types.ts";
import {
  TimerAlreadyRunningError,
  NoTimerRunningError,
  ProjectNotFoundError,
  EntryNotFoundError,
  NoEntriesFoundError,
} from "@/core/errors.ts";
import { generateEntryId } from "@/utils/id.ts";

export async function startTimer(
  repo: Repository,
  input: StartTimerInput = {},
): Promise<Entry> {
  const running = await repo.getRunningEntry();
  if (running) {
    throw new TimerAlreadyRunningError(running.id, running.description);
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
    start_time: input.at ?? new Date().toISOString(),
    end_time: null,
    tags: input.tags ?? [],
    billable: input.billable,
  });
}

export async function stopTimer(
  repo: Repository,
  input: StopTimerInput = {},
): Promise<Entry> {
  const running = await repo.getRunningEntry();
  if (!running) throw new NoTimerRunningError();

  const updates: Record<string, unknown> = {
    end_time: input.at ?? new Date().toISOString(),
  };
  if (input.description !== undefined) updates.description = input.description;
  if (input.tags !== undefined) updates.tags = input.tags;

  return repo.updateEntry(running.id, updates);
}

export async function getStatus(repo: Repository): Promise<StatusResult> {
  const running = await repo.getRunningEntry();
  if (!running) return { running: false };

  const elapsed = Math.floor(
    (Date.now() - new Date(running.start_time).getTime()) / 1000,
  );
  return { running: true, entry: running, elapsed_seconds: elapsed };
}

export async function resumeTimer(
  repo: Repository,
  input: ResumeTimerInput = {},
): Promise<Entry> {
  const running = await repo.getRunningEntry();
  if (running) {
    throw new TimerAlreadyRunningError(running.id, running.description);
  }

  let source: Entry;
  if (input.id) {
    const entry = await repo.getEntry(input.id);
    if (!entry) throw new EntryNotFoundError(input.id);
    source = entry;
  } else {
    const { entries } = await repo.listEntries({ running: false, limit: 1 });
    if (entries.length === 0) {
      throw new NoEntriesFoundError("No previous entries to resume.");
    }
    source = entries[0]!;
  }

  const id = generateEntryId();
  return repo.createEntry({
    id,
    project_id: source.project_id,
    description: source.description,
    start_time: new Date().toISOString(),
    end_time: null,
    tags: [...source.tags],
    billable: source.billable,
  });
}

export async function switchTimer(
  repo: Repository,
  input: SwitchTimerInput,
): Promise<SwitchResult> {
  const stopped = await stopTimer(repo);
  const started = await startTimer(repo, {
    description: input.description,
    project: input.project,
    tags: input.tags,
  });
  return { stopped, started };
}

export async function cancelTimer(repo: Repository): Promise<Entry> {
  const running = await repo.getRunningEntry();
  if (!running) throw new NoTimerRunningError();
  return repo.deleteEntry(running.id);
}
