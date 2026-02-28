import { describe, expect, it } from "bun:test";
import { ValidationError } from "@/core/errors.ts";
import { formatDate, parseDate } from "@/utils/date.ts";

// Fixed reference time: Wednesday, 2026-02-25 14:30:00 UTC
const NOW = new Date("2026-02-25T14:30:00.000Z");

describe("parseDate", () => {
  describe("relative expressions", () => {
    it('parses "now"', () => {
      expect(parseDate("now", NOW)).toBe("2026-02-25T14:30:00.000Z");
    });

    it('parses "2 hours ago"', () => {
      expect(parseDate("2 hours ago", NOW)).toBe("2026-02-25T12:30:00.000Z");
    });

    it('parses "30 minutes ago"', () => {
      expect(parseDate("30 minutes ago", NOW)).toBe("2026-02-25T14:00:00.000Z");
    });

    it('parses "1 day ago"', () => {
      expect(parseDate("1 day ago", NOW)).toBe("2026-02-24T14:30:00.000Z");
    });
  });

  describe("today/yesterday", () => {
    it('parses "today" as start of day UTC', () => {
      expect(parseDate("today", NOW)).toBe("2026-02-25T00:00:00.000Z");
    });

    it('parses "today 9am"', () => {
      expect(parseDate("today 9am", NOW)).toBe("2026-02-25T09:00:00.000Z");
    });

    it('parses "today 14:30"', () => {
      expect(parseDate("today 14:30", NOW)).toBe("2026-02-25T14:30:00.000Z");
    });

    it('parses "today 3:30pm"', () => {
      expect(parseDate("today 3:30pm", NOW)).toBe("2026-02-25T15:30:00.000Z");
    });

    it('parses "yesterday"', () => {
      expect(parseDate("yesterday", NOW)).toBe("2026-02-24T00:00:00.000Z");
    });

    it('parses "yesterday 5pm"', () => {
      expect(parseDate("yesterday 5pm", NOW)).toBe("2026-02-24T17:00:00.000Z");
    });
  });

  describe("last weekday", () => {
    // NOW is Wednesday Feb 25
    it('parses "last monday" (2 days back)', () => {
      expect(parseDate("last monday", NOW)).toBe("2026-02-23T00:00:00.000Z");
    });

    it('parses "last friday" (5 days back)', () => {
      expect(parseDate("last friday", NOW)).toBe("2026-02-20T00:00:00.000Z");
    });

    it('parses "last friday 3pm"', () => {
      expect(parseDate("last friday 3pm", NOW)).toBe("2026-02-20T15:00:00.000Z");
    });

    it('parses "last wednesday" as 7 days back (same weekday)', () => {
      expect(parseDate("last wednesday", NOW)).toBe("2026-02-18T00:00:00.000Z");
    });
  });

  describe("absolute dates", () => {
    it('parses ISO 8601 "2026-02-26T14:30:00Z"', () => {
      expect(parseDate("2026-02-26T14:30:00Z", NOW)).toBe("2026-02-26T14:30:00.000Z");
    });

    it('parses ISO 8601 with milliseconds "2026-02-26T14:30:00.000Z"', () => {
      expect(parseDate("2026-02-26T14:30:00.000Z", NOW)).toBe("2026-02-26T14:30:00.000Z");
    });

    it('parses "2026-02-26" as midnight UTC', () => {
      expect(parseDate("2026-02-26", NOW)).toBe("2026-02-26T00:00:00.000Z");
    });

    it('parses "Feb 26 2026"', () => {
      expect(parseDate("Feb 26 2026", NOW)).toBe("2026-02-26T00:00:00.000Z");
    });
  });

  describe("error handling", () => {
    it("throws on empty string", () => {
      expect(() => parseDate("", NOW)).toThrow(ValidationError);
    });

    it("throws on unparsable input", () => {
      expect(() => parseDate("not a date at all", NOW)).toThrow(ValidationError);
    });

    it("includes accepted formats in error message", () => {
      try {
        parseDate("gibberish", NOW);
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        expect((e as ValidationError).message).toContain("Accepted formats");
      }
    });
  });
});

describe("formatDate", () => {
  it("formats ISO string for display", () => {
    const result = formatDate("2026-02-26T14:30:00.000Z");
    // Output depends on system timezone, just verify it's not empty
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it("accepts custom format", () => {
    const result = formatDate("2026-02-26T14:30:00.000Z", "YYYY/MM/DD");
    expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });
});
