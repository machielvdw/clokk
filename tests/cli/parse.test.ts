import { describe, expect, it } from "bun:test";
import { parseDateArg, parseDurationArg, parseTags, resolveDateShortcuts } from "@/cli/parse.ts";
import { ValidationError } from "@/core/errors.ts";

// Wednesday, 2026-02-25 14:30:00 UTC
const NOW = new Date("2026-02-25T14:30:00.000Z");

// ─── parseTags ───────────────────────────────────────────────────────

describe("parseTags", () => {
  it("parses comma-separated string", () => {
    expect(parseTags("backend,urgent")).toEqual(["backend", "urgent"]);
  });

  it("parses space-separated string", () => {
    expect(parseTags("backend urgent")).toEqual(["backend", "urgent"]);
  });

  it("parses mixed comma and space", () => {
    expect(parseTags("backend, urgent critical")).toEqual(["backend", "urgent", "critical"]);
  });

  it("handles string array input", () => {
    expect(parseTags(["backend", "urgent"])).toEqual(["backend", "urgent"]);
  });

  it("handles string array with commas inside elements", () => {
    expect(parseTags(["backend,urgent", "critical"])).toEqual(["backend", "urgent", "critical"]);
  });

  it("trims whitespace", () => {
    expect(parseTags("  backend , urgent  ")).toEqual(["backend", "urgent"]);
  });

  it("filters empty tags", () => {
    expect(parseTags("backend,,urgent,")).toEqual(["backend", "urgent"]);
  });

  it("deduplicates tags", () => {
    expect(parseTags("backend,backend,urgent")).toEqual(["backend", "urgent"]);
  });

  it("returns empty array for empty string", () => {
    expect(parseTags("")).toEqual([]);
  });

  it("returns empty array for empty array", () => {
    expect(parseTags([])).toEqual([]);
  });
});

// ─── parseDateArg ────────────────────────────────────────────────────

describe("parseDateArg", () => {
  it("parses ISO date string", () => {
    const result = parseDateArg("2026-02-26", NOW);
    expect(result).toBe("2026-02-26T00:00:00.000Z");
  });

  it("parses relative date string", () => {
    const result = parseDateArg("2 hours ago", NOW);
    expect(result).toBe("2026-02-25T12:30:00.000Z");
  });

  it("parses 'now'", () => {
    const result = parseDateArg("now", NOW);
    expect(result).toBe("2026-02-25T14:30:00.000Z");
  });

  it("throws ValidationError for invalid input", () => {
    expect(() => parseDateArg("not-a-date", NOW)).toThrow(ValidationError);
  });
});

// ─── parseDurationArg ────────────────────────────────────────────────

describe("parseDurationArg", () => {
  it("parses hour-minute format", () => {
    expect(parseDurationArg("1h30m")).toBe(5400);
  });

  it("parses minutes only", () => {
    expect(parseDurationArg("45m")).toBe(2700);
  });

  it("parses colon format", () => {
    expect(parseDurationArg("1:30:00")).toBe(5400);
  });

  it("throws ValidationError for invalid input", () => {
    expect(() => parseDurationArg("abc")).toThrow(ValidationError);
  });
});

// ─── resolveDateShortcuts ────────────────────────────────────────────

describe("resolveDateShortcuts", () => {
  it("returns empty object when no shortcuts set", () => {
    expect(resolveDateShortcuts({}, { now: NOW })).toEqual({});
  });

  it("returns explicit from/to when provided, ignoring shortcuts", () => {
    const result = resolveDateShortcuts(
      { from: "2026-02-01T00:00:00.000Z", to: "2026-02-28T00:00:00.000Z", today: true },
      { now: NOW },
    );
    expect(result.from).toBe("2026-02-01T00:00:00.000Z");
    expect(result.to).toBe("2026-02-28T00:00:00.000Z");
  });

  describe("--today", () => {
    it("resolves to start and end of today", () => {
      const result = resolveDateShortcuts({ today: true }, { now: NOW });
      expect(result.from).toBe("2026-02-25T00:00:00.000Z");
      expect(result.to).toBe("2026-02-25T23:59:59.999Z");
    });
  });

  describe("--yesterday", () => {
    it("resolves to start and end of previous day", () => {
      const result = resolveDateShortcuts({ yesterday: true }, { now: NOW });
      expect(result.from).toBe("2026-02-24T00:00:00.000Z");
      expect(result.to).toBe("2026-02-24T23:59:59.999Z");
    });
  });

  describe("--week", () => {
    it("resolves from monday (default) to now", () => {
      // NOW is Wednesday Feb 25, so monday = Feb 23
      const result = resolveDateShortcuts({ week: true }, { now: NOW });
      expect(result.from).toBe("2026-02-23T00:00:00.000Z");
      expect(result.to).toBe("2026-02-25T14:30:00.000Z");
    });

    it("resolves with sunday week start", () => {
      // NOW is Wednesday Feb 25, so sunday = Feb 22
      const result = resolveDateShortcuts({ week: true }, { weekStart: "sunday", now: NOW });
      expect(result.from).toBe("2026-02-22T00:00:00.000Z");
      expect(result.to).toBe("2026-02-25T14:30:00.000Z");
    });

    it("handles when today is the week start day", () => {
      // Monday Feb 23
      const monday = new Date("2026-02-23T10:00:00.000Z");
      const result = resolveDateShortcuts({ week: true }, { weekStart: "monday", now: monday });
      expect(result.from).toBe("2026-02-23T00:00:00.000Z");
      expect(result.to).toBe("2026-02-23T10:00:00.000Z");
    });
  });

  describe("--month", () => {
    it("resolves from start of month to now", () => {
      const result = resolveDateShortcuts({ month: true }, { now: NOW });
      expect(result.from).toBe("2026-02-01T00:00:00.000Z");
      expect(result.to).toBe("2026-02-25T14:30:00.000Z");
    });
  });

  describe("priority", () => {
    it("today takes precedence over other shortcuts", () => {
      const result = resolveDateShortcuts({ today: true, week: true, month: true }, { now: NOW });
      expect(result.from).toBe("2026-02-25T00:00:00.000Z");
      expect(result.to).toBe("2026-02-25T23:59:59.999Z");
    });
  });
});
