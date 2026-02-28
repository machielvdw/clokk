import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek.js";
import utc from "dayjs/plugin/utc.js";
import type {
  Entry,
  ExportFilters,
  ExportResult,
  Project,
  ReportFilters,
  ReportGroup,
  ReportResult,
} from "@/core/types.ts";
import type { Repository } from "@/data/repository.ts";

dayjs.extend(utc);
dayjs.extend(isoWeek);

export async function generateReport(
  repo: Repository,
  filters: ReportFilters,
): Promise<ReportResult> {
  const entries = await repo.getEntriesForReport(filters);
  const groupBy = filters.group_by ?? "project";

  // Resolve project names and rates for entries that have project_id
  const projectCache = new Map<string, Project>();
  for (const entry of entries) {
    if (entry.project_id && !projectCache.has(entry.project_id)) {
      const project = await repo.getProject(entry.project_id);
      if (project) projectCache.set(entry.project_id, project);
    }
  }

  const groups = groupEntries(entries, groupBy, projectCache);

  let totalSeconds = 0;
  let billableSeconds = 0;
  for (const entry of entries) {
    const dur = entry.duration_seconds ?? 0;
    totalSeconds += dur;
    if (entry.billable) billableSeconds += dur;
  }

  return {
    period: {
      from: filters.from ?? entries[0]?.start_time ?? "",
      to:
        filters.to ??
        entries[entries.length - 1]?.end_time ??
        entries[entries.length - 1]?.start_time ??
        "",
    },
    total_seconds: totalSeconds,
    billable_seconds: billableSeconds,
    groups,
  };
}

function groupEntries(
  entries: Entry[],
  groupBy: string,
  projectCache: Map<string, Project>,
): ReportGroup[] {
  const groupMap = new Map<string, Entry[]>();

  for (const entry of entries) {
    const keys = getGroupKeys(entry, groupBy, projectCache);
    for (const key of keys) {
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(entry);
    }
  }

  const groups: ReportGroup[] = [];
  for (const [key, groupEntries] of groupMap) {
    let totalSeconds = 0;
    let billableSeconds = 0;
    for (const entry of groupEntries) {
      const dur = entry.duration_seconds ?? 0;
      totalSeconds += dur;
      if (entry.billable) billableSeconds += dur;
    }

    // Compute billable amount from project rate (only for project grouping)
    let billableAmount: number | null = null;
    let currency: string | null = null;
    if (groupBy === "project") {
      const firstEntry = groupEntries[0]!;
      if (firstEntry.project_id) {
        const project = projectCache.get(firstEntry.project_id);
        if (project?.rate) {
          billableAmount = Math.round((billableSeconds / 3600) * project.rate * 100) / 100;
          currency = project.currency;
        }
      }
    }

    groups.push({
      key,
      total_seconds: totalSeconds,
      billable_seconds: billableSeconds,
      billable_amount: billableAmount,
      currency,
      entry_count: groupEntries.length,
      entries: groupEntries,
    });
  }

  return groups;
}

function getGroupKeys(entry: Entry, groupBy: string, projectCache: Map<string, Project>): string[] {
  switch (groupBy) {
    case "project": {
      if (entry.project_id) {
        const project = projectCache.get(entry.project_id);
        return [project?.name ?? "Unknown Project"];
      }
      return ["No Project"];
    }
    case "tag": {
      if (entry.tags.length === 0) return ["untagged"];
      return entry.tags;
    }
    case "day": {
      return [dayjs.utc(entry.start_time).format("YYYY-MM-DD")];
    }
    case "week": {
      const weekStart = dayjs.utc(entry.start_time).startOf("isoWeek").format("YYYY-MM-DD");
      return [`Week of ${weekStart}`];
    }
    default:
      return ["other"];
  }
}

export async function exportEntries(
  repo: Repository,
  filters: ExportFilters,
): Promise<ExportResult> {
  const entries = await repo.getEntriesForReport({
    project_id: filters.project_id,
    from: filters.from,
    to: filters.to,
  });

  // Resolve project names
  const projectCache = new Map<string, Project>();
  for (const entry of entries) {
    if (entry.project_id && !projectCache.has(entry.project_id)) {
      const project = await repo.getProject(entry.project_id);
      if (project) projectCache.set(entry.project_id, project);
    }
  }

  const format = filters.format ?? "csv";
  let data: string;

  if (format === "json") {
    data = JSON.stringify(
      entries.map((e) => ({
        id: e.id,
        description: e.description,
        project: e.project_id ? (projectCache.get(e.project_id)?.name ?? null) : null,
        start_time: e.start_time,
        end_time: e.end_time,
        duration_seconds: e.duration_seconds,
        tags: e.tags,
        billable: e.billable,
      })),
      null,
      2,
    );
  } else {
    const header = "id,description,project,start_time,end_time,duration_seconds,tags,billable";
    const rows = entries.map((e) => {
      const projectName = e.project_id ? (projectCache.get(e.project_id)?.name ?? "") : "";
      return [
        e.id,
        csvEscape(e.description),
        csvEscape(projectName),
        e.start_time,
        e.end_time ?? "",
        e.duration_seconds?.toString() ?? "",
        csvEscape(e.tags.join("; ")),
        e.billable ? "true" : "false",
      ].join(",");
    });
    data = [header, ...rows].join("\n");
  }

  return {
    data,
    format,
    entry_count: entries.length,
  };
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
