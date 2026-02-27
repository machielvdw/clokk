import { colorize, leftAlign, rightAlign, stripAnsi } from "consola/utils";
import { formatDate } from "@/utils/date.ts";
import { formatDuration } from "@/utils/duration.ts";
import type {
  Entry,
  Project,
  ReportResult,
  StatusResult,
} from "@/core/types.ts";

// ─── Single entry ────────────────────────────────────────────────────

export function formatEntry(entry: Entry): string {
  const lines: string[] = [];

  // Line 1: description + id
  const desc = entry.description || colorize("dim", "(no description)");
  lines.push(`  ${colorize("bold", desc)}  ${colorize("dim", entry.id)}`);

  // Line 2: metadata
  const meta: string[] = [];
  if (entry.project_id) {
    meta.push(`Project: ${colorize("cyan", entry.project_id)}`);
  }
  if (entry.tags.length > 0) {
    meta.push(`Tags: ${colorize("green", entry.tags.join(", "))}`);
  }
  meta.push(entry.billable ? colorize("yellow", "Billable") : colorize("dim", "Non-billable"));
  lines.push("  " + meta.join("  |  "));

  // Line 3: time range + duration
  const start = formatDate(entry.start_time);
  if (entry.end_time) {
    const end = formatDate(entry.end_time);
    const dur = entry.duration_seconds != null ? formatDuration(entry.duration_seconds) : "—";
    lines.push(`  ${start} → ${end}  (${dur})`);
  } else {
    lines.push(`  ${start} → ${colorize("yellow", "running…")}`);
  }

  return lines.join("\n");
}

// ─── Single project ──────────────────────────────────────────────────

export function formatProject(project: Project): string {
  const lines: string[] = [];

  // Line 1: name + id
  lines.push(`  ${colorize("bold", project.name)}  ${colorize("dim", project.id)}`);

  // Line 2: metadata
  const meta: string[] = [];
  if (project.client) {
    meta.push(`Client: ${project.client}`);
  }
  if (project.rate != null) {
    const rate = `$${project.rate.toFixed(2)}/hr (${project.currency})`;
    meta.push(`Rate: ${rate}`);
  }
  if (meta.length > 0) {
    lines.push("  " + meta.join("  |  "));
  }

  // Line 3: status
  const status = project.archived
    ? colorize("yellow", "Archived")
    : colorize("green", "Active");
  lines.push(`  Status: ${status}`);

  return lines.join("\n");
}

// ─── Entry table ─────────────────────────────────────────────────────

const COL_DESC = 30;
const COL_PROJECT = 14;
const COL_START = 18;
const COL_DURATION = 10;

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "…";
}

export function formatEntryTable(
  entries: Entry[],
  opts?: { projectNames?: Map<string, string> },
): string {
  if (entries.length === 0) {
    return colorize("dim", "  No entries found.");
  }

  const projectNames = opts?.projectNames;

  // Header
  const header = [
    leftAlign(colorize("bold", "Description"), COL_DESC),
    leftAlign(colorize("bold", "Project"), COL_PROJECT),
    leftAlign(colorize("bold", "Start"), COL_START),
    rightAlign(colorize("bold", "Duration"), COL_DURATION),
    colorize("bold", "Tags"),
  ].join("  ");

  // Separator based on visible header width
  const sepWidth = stripAnsi(header).length;
  const separator = colorize("dim", "─".repeat(sepWidth));

  // Rows
  const rows = entries.map((entry) => {
    const desc = truncate(entry.description || "—", COL_DESC);
    const project = entry.project_id
      ? truncate(projectNames?.get(entry.project_id) ?? entry.project_id, COL_PROJECT)
      : colorize("dim", "—");
    const start = formatDate(entry.start_time);
    const dur = entry.end_time && entry.duration_seconds != null
      ? formatDuration(entry.duration_seconds)
      : colorize("yellow", "running");
    const tags = entry.tags.length > 0 ? entry.tags.join(", ") : colorize("dim", "—");

    return [
      leftAlign(desc, COL_DESC),
      leftAlign(project, COL_PROJECT),
      leftAlign(start, COL_START),
      rightAlign(dur, COL_DURATION),
      tags,
    ].join("  ");
  });

  return [header, separator, ...rows].join("\n");
}

// ─── Report ──────────────────────────────────────────────────────────

export function formatReport(report: ReportResult): string {
  const lines: string[] = [];

  // Header
  const from = formatDate(report.period.from);
  const to = formatDate(report.period.to);
  lines.push(colorize("bold", `Report: ${from} → ${to}`));
  lines.push(
    `Total: ${colorize("bold", formatDuration(report.total_seconds))}  |  ` +
    `Billable: ${colorize("bold", formatDuration(report.billable_seconds))}`,
  );
  lines.push("");

  // Groups
  for (const group of report.groups) {
    const dur = formatDuration(group.total_seconds);
    let line = `  ${colorize("bold", group.key)}  ${rightAlign(dur, 12)}`;
    if (group.billable_amount != null && group.currency) {
      line += `  ${colorize("green", `$${group.billable_amount.toFixed(2)} ${group.currency}`)}`;
    }
    lines.push(line);
    lines.push(`    ${colorize("dim", `${group.entry_count} entries`)}`);
  }

  if (report.groups.length === 0) {
    lines.push(colorize("dim", "  No entries in this period."));
  }

  return lines.join("\n");
}

// ─── Timer status ────────────────────────────────────────────────────

export function formatStatus(result: StatusResult): string {
  if (!result.running || !result.entry) {
    return colorize("dim", "  No timer running.");
  }

  const entry = result.entry;
  const elapsed = result.elapsed_seconds != null
    ? formatDuration(result.elapsed_seconds)
    : "—";

  const lines: string[] = [];
  lines.push(`  ${colorize("green", "●")} ${colorize("bold", entry.description || "(no description)")}  ${colorize("yellow", elapsed)}`);

  const meta: string[] = [];
  if (entry.project_id) {
    meta.push(`Project: ${colorize("cyan", entry.project_id)}`);
  }
  if (entry.tags.length > 0) {
    meta.push(`Tags: ${colorize("green", entry.tags.join(", "))}`);
  }
  if (meta.length > 0) {
    lines.push("  " + meta.join("  |  "));
  }

  lines.push(`  Started: ${formatDate(entry.start_time)}`);

  return lines.join("\n");
}
