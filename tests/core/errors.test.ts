import { describe, expect, it } from "bun:test";
import {
  ClokkError,
  ConfigKeyUnknownError,
  ConfigValueInvalidError,
  ConflictError,
  DatabaseError,
  EntryNotFoundError,
  NoEntriesFoundError,
  NoTimerRunningError,
  ProjectAlreadyExistsError,
  ProjectHasEntriesError,
  ProjectNotFoundError,
  TimerAlreadyRunningError,
  ValidationError,
} from "@/core/errors.ts";

describe("ClokkError", () => {
  it("sets code, message, suggestions, context, and exitCode", () => {
    const err = new ClokkError({
      code: "TEST",
      message: "test error",
      suggestions: ["fix it"],
      context: { foo: "bar" },
      exitCode: 2,
    });
    expect(err.code).toBe("TEST");
    expect(err.message).toBe("test error");
    expect(err.suggestions).toEqual(["fix it"]);
    expect(err.context).toEqual({ foo: "bar" });
    expect(err.exitCode).toBe(2);
  });

  it("defaults suggestions to empty array and exitCode to 1", () => {
    const err = new ClokkError({ code: "TEST", message: "test" });
    expect(err.suggestions).toEqual([]);
    expect(err.context).toEqual({});
    expect(err.exitCode).toBe(1);
  });
});

describe("TimerAlreadyRunningError", () => {
  const err = new TimerAlreadyRunningError("ent_abc", "Bug triage");

  it("has correct code", () => expect(err.code).toBe("TIMER_ALREADY_RUNNING"));
  it("has exitCode 1", () => expect(err.exitCode).toBe(1));
  it("is instanceof ClokkError", () => expect(err).toBeInstanceOf(ClokkError));
  it("includes entry ID in context", () => expect(err.context.running_entry_id).toBe("ent_abc"));
  it("includes suggestions", () => expect(err.suggestions.length).toBeGreaterThan(0));
});

describe("NoTimerRunningError", () => {
  const err = new NoTimerRunningError();

  it("has correct code", () => expect(err.code).toBe("NO_TIMER_RUNNING"));
  it("has exitCode 1", () => expect(err.exitCode).toBe(1));
  it("is instanceof ClokkError", () => expect(err).toBeInstanceOf(ClokkError));
});

describe("EntryNotFoundError", () => {
  const err = new EntryNotFoundError("ent_xyz");

  it("has correct code", () => expect(err.code).toBe("ENTRY_NOT_FOUND"));
  it("includes entry ID in context", () => expect(err.context.entry_id).toBe("ent_xyz"));
});

describe("ProjectNotFoundError", () => {
  const err = new ProjectNotFoundError("acme");

  it("has correct code", () => expect(err.code).toBe("PROJECT_NOT_FOUND"));
  it("includes project ref in context", () => expect(err.context.project_ref).toBe("acme"));
});

describe("ProjectAlreadyExistsError", () => {
  const err = new ProjectAlreadyExistsError("acme");

  it("has correct code", () => expect(err.code).toBe("PROJECT_ALREADY_EXISTS"));
  it("includes project name in context", () => expect(err.context.project_name).toBe("acme"));
});

describe("ProjectHasEntriesError", () => {
  const err = new ProjectHasEntriesError("prj_abc", 5);

  it("has correct code", () => expect(err.code).toBe("PROJECT_HAS_ENTRIES"));
  it("includes entry count in context", () => expect(err.context.entry_count).toBe(5));
  it("suggests --force", () => expect(err.suggestions[0]).toContain("--force"));
});

describe("ValidationError", () => {
  const err = new ValidationError("Invalid date format", { input: "not-a-date" });

  it("has correct code", () => expect(err.code).toBe("VALIDATION_ERROR"));
  it("includes context", () => expect(err.context.input).toBe("not-a-date"));
});

describe("ConflictError", () => {
  it("has correct code", () => expect(new ConflictError("ent_abc").code).toBe("CONFLICT"));
});

describe("NoEntriesFoundError", () => {
  it("has correct code", () => expect(new NoEntriesFoundError().code).toBe("NO_ENTRIES_FOUND"));
  it("accepts custom message", () => {
    expect(new NoEntriesFoundError("Nothing here").message).toBe("Nothing here");
  });
});

describe("ConfigKeyUnknownError", () => {
  const err = new ConfigKeyUnknownError("foo.bar");

  it("has correct code", () => expect(err.code).toBe("CONFIG_KEY_UNKNOWN"));
  it("includes key in context", () => expect(err.context.key).toBe("foo.bar"));
});

describe("ConfigValueInvalidError", () => {
  const err = new ConfigValueInvalidError("week_start", 42, "string");

  it("has correct code", () => expect(err.code).toBe("CONFIG_VALUE_INVALID"));
  it("includes key and expected type in context", () => {
    expect(err.context.key).toBe("week_start");
    expect(err.context.expected_type).toBe("string");
  });
});

describe("DatabaseError", () => {
  it("has correct code", () => expect(new DatabaseError("disk full").code).toBe("DATABASE_ERROR"));
  it("has exitCode 2", () => expect(new DatabaseError("disk full").exitCode).toBe(2));
  it("captures cause message", () => {
    const err = new DatabaseError("failed", new Error("SQLITE_BUSY"));
    expect(err.context.cause).toBe("SQLITE_BUSY");
  });
});
