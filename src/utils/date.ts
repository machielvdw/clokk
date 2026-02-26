import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import utc from "dayjs/plugin/utc.js";
import { ValidationError } from "@/core/errors.ts";

dayjs.extend(utc);
dayjs.extend(customParseFormat);

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

const ACCEPTED_FORMATS_MSG = [
  'Accepted formats: "now", "today 9am", "yesterday 5pm", "2 hours ago",',
  '"last monday 3pm", "2026-02-26", "Feb 26", "2026-02-26T14:30:00Z".',
].join(" ");

/**
 * Parse a flexible date/time string into an ISO 8601 UTC string.
 * Accepts relative times, natural language, and standard date formats.
 * Pass `now` for deterministic testing.
 */
export function parseDate(input: string, now?: Date): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ValidationError("Date cannot be empty.", { input });
  }

  const reference = now ? dayjs.utc(now) : dayjs.utc();

  // "now"
  if (trimmed.toLowerCase() === "now") {
    return reference.toISOString();
  }

  // Relative: "N hours ago", "N minutes ago", "N days ago"
  const relativeMatch = trimmed.match(/^(\d+)\s+(second|minute|hour|day|week)s?\s+ago$/i);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1]!, 10);
    const unit = relativeMatch[2]!.toLowerCase() as dayjs.ManipulateType;
    return reference.subtract(amount, unit).toISOString();
  }

  // "today" or "today 9am" / "today 14:30"
  const todayMatch = trimmed.match(/^today(?:\s+(.+))?$/i);
  if (todayMatch) {
    const timeStr = todayMatch[1];
    const base = reference.startOf("day");
    return timeStr ? applyTime(base, timeStr, input) : base.toISOString();
  }

  // "yesterday" or "yesterday 5pm"
  const yesterdayMatch = trimmed.match(/^yesterday(?:\s+(.+))?$/i);
  if (yesterdayMatch) {
    const timeStr = yesterdayMatch[1];
    const base = reference.subtract(1, "day").startOf("day");
    return timeStr ? applyTime(base, timeStr, input) : base.toISOString();
  }

  // "last monday", "last friday 3pm"
  const lastDayMatch = trimmed.match(/^last\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(.+))?$/i);
  if (lastDayMatch) {
    const targetDay = WEEKDAYS.indexOf(lastDayMatch[1]!.toLowerCase() as typeof WEEKDAYS[number]);
    const timeStr = lastDayMatch[2];
    const currentDay = reference.day();
    let daysBack = currentDay - targetDay;
    if (daysBack <= 0) daysBack += 7;
    const base = reference.subtract(daysBack, "day").startOf("day");
    return timeStr ? applyTime(base, timeStr, input) : base.toISOString();
  }

  // ISO 8601 passthrough: "2026-02-26T14:30:00Z" or "2026-02-26T14:30:00.000Z"
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
    const parsed = dayjs.utc(trimmed);
    if (parsed.isValid()) {
      return parsed.toISOString();
    }
  }

  // Standard date formats: "2026-02-26", "Feb 26", "Feb 26 2026"
  const formats = [
    "YYYY-MM-DD",
    "MMM D YYYY",
    "MMM D",
    "MMMM D YYYY",
    "MMMM D",
    "MM/DD/YYYY",
    "DD/MM/YYYY",
  ];

  for (const fmt of formats) {
    const parsed = dayjs.utc(trimmed, fmt, true);
    if (parsed.isValid()) {
      // If no year in format, use current year
      if (!fmt.includes("YYYY") && parsed.year() === 2001) {
        return parsed.year(reference.year()).toISOString();
      }
      return parsed.toISOString();
    }
  }

  // Last attempt: let dayjs try to parse it
  const fallback = dayjs.utc(trimmed);
  if (fallback.isValid()) {
    return fallback.toISOString();
  }

  throw new ValidationError(
    `Unable to parse date: "${input}". ${ACCEPTED_FORMATS_MSG}`,
    { input },
  );
}

/**
 * Apply a time string like "9am", "14:30", "3pm", "3:30pm" to a dayjs date.
 */
function applyTime(base: dayjs.Dayjs, timeStr: string, originalInput: string): string {
  const t = timeStr.trim().toLowerCase();

  // "14:30" or "9:00"
  const time24Match = t.match(/^(\d{1,2}):(\d{2})$/);
  if (time24Match) {
    return base.hour(parseInt(time24Match[1]!, 10)).minute(parseInt(time24Match[2]!, 10)).toISOString();
  }

  // "9am", "3pm", "3:30pm", "12:00am"
  const time12Match = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (time12Match) {
    let hours = parseInt(time12Match[1]!, 10);
    const minutes = time12Match[2] ? parseInt(time12Match[2], 10) : 0;
    const period = time12Match[3]!;

    if (period === "pm" && hours !== 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;

    return base.hour(hours).minute(minutes).toISOString();
  }

  throw new ValidationError(
    `Unable to parse time "${timeStr}" in "${originalInput}". Use formats like "9am", "14:30", "3:30pm".`,
    { input: originalInput },
  );
}

/**
 * Format an ISO 8601 UTC string for human display.
 */
export function formatDate(isoString: string, format?: string): string {
  const d = dayjs.utc(isoString).local();
  return d.format(format ?? "YYYY-MM-DD HH:mm");
}
