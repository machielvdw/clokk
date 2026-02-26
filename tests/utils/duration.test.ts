import { describe, expect, it } from "bun:test";
import { formatDuration, parseDuration } from "@/utils/duration.ts";
import { ValidationError } from "@/core/errors.ts";

describe("parseDuration", () => {
  it('parses "1h30m" → 5400', () => expect(parseDuration("1h30m")).toBe(5400));
  it('parses "1h 30m" → 5400', () => expect(parseDuration("1h 30m")).toBe(5400));
  it('parses "1.5h" → 5400', () => expect(parseDuration("1.5h")).toBe(5400));
  it('parses "90m" → 5400', () => expect(parseDuration("90m")).toBe(5400));
  it('parses "90 minutes" → 5400', () => expect(parseDuration("90 minutes")).toBe(5400));
  it('parses "1:30:00" → 5400', () => expect(parseDuration("1:30:00")).toBe(5400));
  it('parses "0:45" → 2700', () => expect(parseDuration("0:45")).toBe(2700));
  it('parses "30s" → 30', () => expect(parseDuration("30s")).toBe(30));
  it('parses "30 seconds" → 30', () => expect(parseDuration("30 seconds")).toBe(30));

  it('parses "2h" → 7200', () => expect(parseDuration("2h")).toBe(7200));
  it('parses "45m" → 2700', () => expect(parseDuration("45m")).toBe(2700));
  it('parses "2h 15m 30s" → 8130', () => expect(parseDuration("2h 15m 30s")).toBe(8130));
  it('parses "1 hour" → 3600', () => expect(parseDuration("1 hour")).toBe(3600));
  it('parses "2 hours" → 7200', () => expect(parseDuration("2 hours")).toBe(7200));

  it("trims whitespace", () => expect(parseDuration("  1h  ")).toBe(3600));

  it("throws on empty string", () => {
    expect(() => parseDuration("")).toThrow(ValidationError);
  });

  it("throws on unparsable input", () => {
    expect(() => parseDuration("hello")).toThrow(ValidationError);
  });

  it("throws on random text", () => {
    expect(() => parseDuration("about three hours")).toThrow(ValidationError);
  });
});

describe("formatDuration", () => {
  it("formats 0 as '0s'", () => expect(formatDuration(0)).toBe("0s"));
  it("formats 30 as '30s'", () => expect(formatDuration(30)).toBe("30s"));
  it("formats 2700 as '45m'", () => expect(formatDuration(2700)).toBe("45m"));
  it("formats 3600 as '1h'", () => expect(formatDuration(3600)).toBe("1h"));
  it("formats 5400 as '1h 30m'", () => expect(formatDuration(5400)).toBe("1h 30m"));
  it("formats 8130 as '2h 15m 30s'", () => expect(formatDuration(8130)).toBe("2h 15m 30s"));
  it("formats negative durations with minus sign", () => expect(formatDuration(-3600)).toBe("-1h"));
});
