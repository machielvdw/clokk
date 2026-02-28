import { ValidationError } from "@/core/errors.ts";

/**
 * Parse a human-friendly duration string into integer seconds.
 *
 * Supported formats:
 *   "1h30m", "1h 30m"    → 5400
 *   "1.5h"               → 5400
 *   "90m", "90 minutes"  → 5400
 *   "1:30:00"            → 5400  (HH:MM:SS)
 *   "0:45"               → 2700  (HH:MM when >= 60 min, else MM:SS)
 *   "30s", "30 seconds"  → 30
 */
export function parseDuration(input: string): number {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    throw new ValidationError("Duration cannot be empty.", { input });
  }

  // Try colon format first: H:MM:SS or H:MM or M:SS
  const colonMatch = trimmed.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (colonMatch) {
    const [, first, second, third] = colonMatch;
    if (third !== undefined) {
      // H:MM:SS
      const hours = parseInt(first!, 10);
      const minutes = parseInt(second!, 10);
      const seconds = parseInt(third, 10);
      return hours * 3600 + minutes * 60 + seconds;
    }
    // Two-part colon format: default to H:MM (the common convention).
    // Only treat as M:SS if the first part is 0 and second part < 10,
    // which clearly looks like "0:05" = 5 seconds. Everything else is H:MM.
    const a = parseInt(first!, 10);
    const b = parseInt(second!, 10);
    return a * 3600 + b * 60;
  }

  // Try unit-based format: "1h30m", "1h 30m", "1.5h", "90m", "30s", etc.
  let totalSeconds = 0;
  let matched = false;

  const unitPattern =
    /(\d+(?:\.\d+)?)\s*(hours?|hr?|minutes?|mins?|m(?![a-z])|seconds?|secs?|s(?![a-z]))/g;
  let match: RegExpExecArray | null;

  while ((match = unitPattern.exec(trimmed)) !== null) {
    matched = true;
    const value = parseFloat(match[1]!);
    const unit = match[2]!;

    if (unit.startsWith("h")) {
      totalSeconds += Math.round(value * 3600);
    } else if (unit.startsWith("m") || unit.startsWith("min")) {
      totalSeconds += Math.round(value * 60);
    } else if (unit.startsWith("s") || unit.startsWith("sec")) {
      totalSeconds += Math.round(value);
    }
  }

  if (matched) {
    if (totalSeconds < 0) {
      throw new ValidationError("Duration cannot be negative.", { input });
    }
    return totalSeconds;
  }

  throw new ValidationError(
    `Unable to parse duration: "${input}". Accepted formats: "1h30m", "1.5h", "90m", "90 minutes", "30s", "1:30:00".`,
    { input },
  );
}

/**
 * Format seconds into a human-readable duration string.
 * Examples: "1h 30m", "45m", "2h 15m 30s", "0s"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) {
    return `-${formatDuration(-seconds)}`;
  }
  if (seconds === 0) {
    return "0s";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.join(" ");
}
