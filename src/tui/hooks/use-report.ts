import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { createEffect, createSignal } from "solid-js";
import { generateReport } from "@/core/reports.ts";
import type { ReportFilters, ReportResult } from "@/core/types.ts";
import { useRepo } from "@/tui/hooks/use-repo.ts";

dayjs.extend(utc);

export type RangePeriod = "day" | "week" | "month";

export function useReport() {
  const repo = useRepo();
  const [report, setReport] = createSignal<ReportResult | null>(null);
  const [period, setPeriod] = createSignal<RangePeriod>("week");
  const [offset, setOffset] = createSignal(0);
  const [groupBy, setGroupBy] = createSignal<NonNullable<ReportFilters["group_by"]>>("project");
  const [loading, setLoading] = createSignal(false);

  function getDateRange(): { from: string; to: string } {
    const now = dayjs.utc();
    const p = period();
    const off = offset();

    let start: dayjs.Dayjs;
    let end: dayjs.Dayjs;

    if (p === "day") {
      start = now.add(off, "day").startOf("day");
      end = start.endOf("day");
    } else if (p === "week") {
      start = now.add(off, "week").startOf("week");
      end = start.endOf("week");
    } else {
      start = now.add(off, "month").startOf("month");
      end = start.endOf("month");
    }

    return { from: start.toISOString(), to: end.toISOString() };
  }

  async function refresh() {
    setLoading(true);
    try {
      const range = getDateRange();
      const result = await generateReport(repo, {
        from: range.from,
        to: range.to,
        group_by: groupBy(),
      });
      setReport(result);
    } catch {
      // Swallow errors
    } finally {
      setLoading(false);
    }
  }

  // Re-fetch when reactive deps change
  createEffect(() => {
    period();
    offset();
    groupBy();
    refresh();
  });

  function navigateBack() {
    setOffset((o) => o - 1);
  }

  function navigateForward() {
    setOffset((o) => Math.min(0, o + 1));
  }

  function resetToNow() {
    setOffset(0);
  }

  const GROUP_BY_OPTIONS: NonNullable<ReportFilters["group_by"]>[] = [
    "project",
    "tag",
    "day",
    "week",
  ];

  function cycleGroupBy() {
    const current = groupBy();
    const idx = GROUP_BY_OPTIONS.indexOf(current);
    const next = GROUP_BY_OPTIONS[(idx + 1) % GROUP_BY_OPTIONS.length]!;
    setGroupBy(next);
  }

  return {
    report,
    period,
    setPeriod,
    offset,
    groupBy,
    loading,
    navigateBack,
    navigateForward,
    resetToNow,
    cycleGroupBy,
    getDateRange,
  };
}
