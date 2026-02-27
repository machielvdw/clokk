import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  detectOutputMode,
  formatSuccessJson,
  formatErrorJson,
  success,
  error,
} from "@/cli/output.ts";
import {
  TimerAlreadyRunningError,
  NoTimerRunningError,
  ValidationError,
  DatabaseError,
} from "@/core/errors.ts";

// ─── detectOutputMode ────────────────────────────────────────────────

describe("detectOutputMode", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.CLOKK_OUTPUT = process.env.CLOKK_OUTPUT;
    delete process.env.CLOKK_OUTPUT;
  });

  afterEach(() => {
    if (savedEnv.CLOKK_OUTPUT !== undefined) {
      process.env.CLOKK_OUTPUT = savedEnv.CLOKK_OUTPUT;
    } else {
      delete process.env.CLOKK_OUTPUT;
    }
  });

  it("returns 'human' when isTTY is true", () => {
    expect(detectOutputMode({ isTTY: true })).toBe("human");
  });

  it("returns 'json' when isTTY is false (piped)", () => {
    expect(detectOutputMode({ isTTY: false })).toBe("json");
  });

  it("returns 'json' when --json flag is set regardless of TTY", () => {
    expect(detectOutputMode({ json: true, isTTY: true })).toBe("json");
  });

  it("returns 'human' when --human flag is set regardless of piping", () => {
    expect(detectOutputMode({ human: true, isTTY: false })).toBe("human");
  });

  it("--json takes precedence over --human", () => {
    expect(detectOutputMode({ json: true, human: true })).toBe("json");
  });

  it("respects CLOKK_OUTPUT=json env var", () => {
    process.env.CLOKK_OUTPUT = "json";
    expect(detectOutputMode({ isTTY: true })).toBe("json");
  });

  it("respects CLOKK_OUTPUT=human env var", () => {
    process.env.CLOKK_OUTPUT = "human";
    expect(detectOutputMode({ isTTY: false })).toBe("human");
  });

  it("flag overrides take precedence over CLOKK_OUTPUT", () => {
    process.env.CLOKK_OUTPUT = "json";
    expect(detectOutputMode({ human: true, isTTY: false })).toBe("human");
  });

  it("defaults to json when no TTY info available", () => {
    expect(detectOutputMode({ isTTY: false })).toBe("json");
  });
});

// ─── formatSuccessJson ───────────────────────────────────────────────

describe("formatSuccessJson", () => {
  it("produces correct JSON envelope", () => {
    const data = { id: "ent_abc123", description: "Test" };
    const result = JSON.parse(formatSuccessJson(data, "Timer started"));

    expect(result.ok).toBe(true);
    expect(result.data).toEqual(data);
    expect(result.message).toBe("Timer started");
  });

  it("does not include error field on success", () => {
    const result = JSON.parse(formatSuccessJson({}, "Done"));
    expect(result.error).toBeUndefined();
  });

  it("handles complex nested data", () => {
    const data = {
      entries: [
        { id: "ent_1", tags: ["backend", "urgent"], billable: true },
        { id: "ent_2", tags: [], billable: false },
      ],
      total: 2,
    };
    const result = JSON.parse(formatSuccessJson(data, "Listed entries"));
    expect(result.data.entries).toHaveLength(2);
    expect(result.data.entries[0].tags).toEqual(["backend", "urgent"]);
  });

  it("handles null data", () => {
    const result = JSON.parse(formatSuccessJson(null, "No data"));
    expect(result.ok).toBe(true);
    expect(result.data).toBeNull();
  });
});

// ─── formatErrorJson ─────────────────────────────────────────────────

describe("formatErrorJson", () => {
  it("produces correct error envelope for TimerAlreadyRunningError", () => {
    const err = new TimerAlreadyRunningError("ent_abc123", "Bug triage");
    const result = JSON.parse(formatErrorJson(err));

    expect(result.ok).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error.code).toBe("TIMER_ALREADY_RUNNING");
    expect(result.error.message).toContain("Bug triage");
    expect(result.error.suggestions).toContain("clokk stop");
    expect(result.error.context.running_entry_id).toBe("ent_abc123");
    expect(result.error.context.running_description).toBe("Bug triage");
  });

  it("handles errors with empty suggestions and context", () => {
    const err = new NoTimerRunningError();
    const result = JSON.parse(formatErrorJson(err));

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("NO_TIMER_RUNNING");
    expect(result.error.suggestions).toEqual(["clokk start"]);
    expect(result.error.context).toEqual({});
  });

  it("includes validation error details", () => {
    const err = new ValidationError("Invalid date format", { input: "not-a-date" });
    const result = JSON.parse(formatErrorJson(err));

    expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(result.error.context.input).toBe("not-a-date");
  });

  it("uses exitCode 2 for system errors", () => {
    const err = new DatabaseError("disk full");
    expect(err.exitCode).toBe(2);

    const result = JSON.parse(formatErrorJson(err));
    expect(result.error.code).toBe("DATABASE_ERROR");
  });
});

// ─── success (side-effecting) ────────────────────────────────────────

describe("success", () => {
  it("writes JSON envelope to stdout in json mode", () => {
    let output = "";
    const mockStdout = { write: (s: string) => { output += s; } };

    success({ id: "ent_1" }, "Created", undefined, {
      mode: "json",
      stdout: mockStdout,
    });

    const parsed = JSON.parse(output.trim());
    expect(parsed.ok).toBe(true);
    expect(parsed.data.id).toBe("ent_1");
  });

  it("uses humanFormatter in human mode", () => {
    let output = "";
    const mockStdout = { write: (s: string) => { output += s; } };

    success(
      { id: "ent_1" },
      "Created",
      (data) => `Entry: ${(data as { id: string }).id}`,
      { mode: "human", stdout: mockStdout },
    );

    expect(output.trim()).toBe("Entry: ent_1");
  });

  it("falls back to message when no humanFormatter", () => {
    let output = "";
    const mockStdout = { write: (s: string) => { output += s; } };

    success({ id: "ent_1" }, "Timer started", undefined, {
      mode: "human",
      stdout: mockStdout,
    });

    expect(output.trim()).toBe("Timer started");
  });
});

// ─── error (side-effecting) ──────────────────────────────────────────

describe("error", () => {
  it("writes JSON error envelope to stderr in json mode and exits", () => {
    let output = "";
    let exitCode = -1;
    const mockStderr = { write: (s: string) => { output += s; } };
    const mockExit = (code: number) => { exitCode = code; };

    expect(() =>
      error(new TimerAlreadyRunningError("ent_1", "Test"), undefined, {
        mode: "json",
        stderr: mockStderr,
        exit: mockExit,
      })
    ).toThrow();

    const parsed = JSON.parse(output.trim());
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("TIMER_ALREADY_RUNNING");
    expect(exitCode).toBe(1);
  });

  it("uses exitCode 2 for system errors", () => {
    let exitCode = -1;
    const mockStderr = { write: () => {} };
    const mockExit = (code: number) => { exitCode = code; };

    expect(() =>
      error(new DatabaseError("timeout"), undefined, {
        mode: "json",
        stderr: mockStderr,
        exit: mockExit,
      })
    ).toThrow();

    expect(exitCode).toBe(2);
  });

  it("writes human-formatted error in human mode", () => {
    let output = "";
    const mockStderr = { write: (s: string) => { output += s; } };
    const mockExit = () => {};

    expect(() =>
      error(new NoTimerRunningError(), undefined, {
        mode: "human",
        stderr: mockStderr,
        exit: mockExit,
      })
    ).toThrow();

    expect(output).toContain("Error:");
    expect(output).toContain("No timer is currently running");
  });

  it("uses custom humanFormatter when provided", () => {
    let output = "";
    const mockStderr = { write: (s: string) => { output += s; } };
    const mockExit = () => {};

    expect(() =>
      error(
        new NoTimerRunningError(),
        (err) => `Custom: ${err.code}`,
        { mode: "human", stderr: mockStderr, exit: mockExit },
      )
    ).toThrow();

    expect(output.trim()).toBe("Custom: NO_TIMER_RUNNING");
  });
});
