import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { parseDate } from "@/utils/date.ts";
import { parseDuration } from "@/utils/duration.ts";

dayjs.extend(utc);

const WEEKDAYS = [
  "sunday", "monday", "tuesday", "wednesday",
  "thursday", "friday", "saturday",
] as const;

// ─── Tag parsing ─────────────────────────────────────────────────────

/**
 * Parse tags from CLI input. Handles comma-separated, space-separated,
 * and mixed formats. Deduplicates while preserving order.
 */
export function parseTags(input: string | string[]): string[] {
  const raw = Array.isArray(input) ? input.join(",") : input;
  const tags = raw
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return [...new Set(tags)];
}

// ─── Date/duration argument wrappers ─────────────────────────────────

/**
 * Parse a date argument from CLI input into an ISO 8601 UTC string.
 * Delegates to the core parseDate utility.
 */
export function parseDateArg(input: string, now?: Date): string {
  return parseDate(input, now);
}

/**
 * Parse a duration argument from CLI input into seconds.
 * Delegates to the core parseDuration utility.
 */
export function parseDurationArg(input: string): number {
  return parseDuration(input);
}

// ─── Date shortcut resolution ────────────────────────────────────────

/**
 * Convert date shortcut flags (--today, --yesterday, --week, --month)
 * into a { from, to } date range. Explicit from/to take precedence.
 */
export function resolveDateShortcuts(
  args: {
    today?: boolean;
    yesterday?: boolean;
    week?: boolean;
    month?: boolean;
    from?: string;
    to?: string;
  },
  opts?: { weekStart?: string; now?: Date },
): { from?: string; to?: string } {
  // Explicit dates take precedence over shortcuts
  if (args.from !== undefined || args.to !== undefined) {
    return { from: args.from, to: args.to };
  }

  const ref = dayjs.utc(opts?.now ?? new Date());

  if (args.today) {
    return {
      from: ref.startOf("day").toISOString(),
      to: ref.endOf("day").toISOString(),
    };
  }

  if (args.yesterday) {
    const yesterday = ref.subtract(1, "day");
    return {
      from: yesterday.startOf("day").toISOString(),
      to: yesterday.endOf("day").toISOString(),
    };
  }

  if (args.week) {
    const weekStart = (opts?.weekStart ?? "monday").toLowerCase();
    const weekStartIdx = WEEKDAYS.indexOf(weekStart as typeof WEEKDAYS[number]);
    const startDay = weekStartIdx === -1 ? 1 : weekStartIdx; // default monday
    const currentDay = ref.day();
    let daysBack = currentDay - startDay;
    if (daysBack < 0) daysBack += 7;
    return {
      from: ref.subtract(daysBack, "day").startOf("day").toISOString(),
      to: ref.toISOString(),
    };
  }

  if (args.month) {
    return {
      from: ref.startOf("month").toISOString(),
      to: ref.toISOString(),
    };
  }

  return {};
}
