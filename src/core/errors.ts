export class ClokkError extends Error {
  readonly code: string;
  readonly suggestions: string[];
  readonly context: Record<string, unknown>;
  readonly exitCode: number;

  constructor(opts: {
    code: string;
    message: string;
    suggestions?: string[];
    context?: Record<string, unknown>;
    exitCode?: number;
  }) {
    super(opts.message);
    this.name = "ClokkError";
    this.code = opts.code;
    this.suggestions = opts.suggestions ?? [];
    this.context = opts.context ?? {};
    this.exitCode = opts.exitCode ?? 1;
  }
}

export class TimerAlreadyRunningError extends ClokkError {
  constructor(entryId: string, description: string) {
    super({
      code: "TIMER_ALREADY_RUNNING",
      message: `A timer is already running: "${description}" (${entryId}). Stop it first with 'clokk stop' or use 'clokk switch' to stop and start in one command.`,
      suggestions: ["clokk stop", `clokk switch "<new description>"`],
      context: { running_entry_id: entryId, running_description: description },
    });
  }
}

export class NoTimerRunningError extends ClokkError {
  constructor() {
    super({
      code: "NO_TIMER_RUNNING",
      message: "No timer is currently running. Start one with 'clokk start'.",
      suggestions: ["clokk start"],
    });
  }
}

export class EntryNotFoundError extends ClokkError {
  constructor(entryId: string) {
    super({
      code: "ENTRY_NOT_FOUND",
      message: `Entry "${entryId}" not found.`,
      suggestions: ["clokk list --today"],
      context: { entry_id: entryId },
    });
  }
}

export class ProjectNotFoundError extends ClokkError {
  constructor(ref: string) {
    super({
      code: "PROJECT_NOT_FOUND",
      message: `Project "${ref}" not found.`,
      suggestions: ["clokk project list"],
      context: { project_ref: ref },
    });
  }
}

export class ProjectAlreadyExistsError extends ClokkError {
  constructor(name: string) {
    super({
      code: "PROJECT_ALREADY_EXISTS",
      message: `A project named "${name}" already exists.`,
      suggestions: ["clokk project list"],
      context: { project_name: name },
    });
  }
}

export class ProjectHasEntriesError extends ClokkError {
  constructor(projectId: string, entryCount: number) {
    super({
      code: "PROJECT_HAS_ENTRIES",
      message: `Project "${projectId}" has ${entryCount} entries. Use --force to delete anyway (entries will become unassigned).`,
      suggestions: [`clokk project delete ${projectId} --force`],
      context: { project_id: projectId, entry_count: entryCount },
    });
  }
}

export class ValidationError extends ClokkError {
  constructor(message: string, context?: Record<string, unknown>) {
    super({
      code: "VALIDATION_ERROR",
      message,
      context,
    });
  }
}

export class ConflictError extends ClokkError {
  constructor(entryId: string) {
    super({
      code: "CONFLICT",
      message: `Entry "${entryId}" was modified since last read. Re-fetch and try again.`,
      suggestions: [`clokk list --json`],
      context: { entry_id: entryId },
    });
  }
}

export class NoEntriesFoundError extends ClokkError {
  constructor(message?: string) {
    super({
      code: "NO_ENTRIES_FOUND",
      message: message ?? "No entries found matching the given filters.",
    });
  }
}

export class ConfigKeyUnknownError extends ClokkError {
  constructor(key: string) {
    super({
      code: "CONFIG_KEY_UNKNOWN",
      message: `Unknown configuration key: "${key}".`,
      suggestions: ["clokk config show"],
      context: { key },
    });
  }
}

export class ConfigValueInvalidError extends ClokkError {
  constructor(key: string, value: unknown, expectedType: string) {
    super({
      code: "CONFIG_VALUE_INVALID",
      message: `Invalid value for "${key}": expected ${expectedType}, got ${typeof value}.`,
      context: { key, value, expected_type: expectedType },
    });
  }
}

export class DatabaseError extends ClokkError {
  constructor(message: string, cause?: unknown) {
    super({
      code: "DATABASE_ERROR",
      message: `Database error: ${message}`,
      exitCode: 2,
      context: cause instanceof Error ? { cause: cause.message } : {},
    });
  }
}
