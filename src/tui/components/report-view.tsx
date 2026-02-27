import { Show, For } from "solid-js";
import type { Accessor } from "solid-js";
import type { ReportResult, ReportGroup } from "@/core/types.ts";
import { formatDuration } from "@/utils/duration.ts";
import { formatDate } from "@/utils/date.ts";
import type { RangePeriod } from "@/tui/hooks/use-report.ts";

interface ReportViewProps {
  report: Accessor<ReportResult | null>;
  period: Accessor<RangePeriod>;
  groupBy: Accessor<string>;
  loading: Accessor<boolean>;
  getDateRange: () => { from: string; to: string };
}

const BAR_WIDTH = 30;

export function ReportView(props: ReportViewProps) {
  const range = () => props.getDateRange();

  return (
    <box flexDirection="column" padding={1} width="100%" flexGrow={1}>
      {/* Header */}
      <box flexDirection="row" justifyContent="space-between">
        <text fg="#ffffff" attributes={1}>
          {formatDate(range().from)} \u2014 {formatDate(range().to)}
        </text>
        <text fg="#6b7280">
          [{props.period()}] [{props.groupBy()}] h/l:nav d/w/m:period g:group
        </text>
      </box>

      <Show when={props.loading()}>
        <text fg="#eab308" marginTop={1}>
          Loading...
        </text>
      </Show>

      <Show when={props.report() && !props.loading()}>
        {/* Totals */}
        <box flexDirection="row" marginTop={1} gap={3}>
          <text fg="#ffffff" attributes={1}>
            Total: {formatDuration(props.report()!.total_seconds)}
          </text>
          <text fg="#22c55e">
            Billable: {formatDuration(props.report()!.billable_seconds)}
          </text>
        </box>

        {/* Bar chart */}
        <box flexDirection="column" marginTop={1} flexGrow={1}>
          <For each={props.report()!.groups}>
            {(group) => (
              <ReportBar
                group={group}
                maxSeconds={getMaxSeconds(props.report()!)}
              />
            )}
          </For>
          <Show when={props.report()!.groups.length === 0}>
            <text fg="#6b7280">No entries in this period.</text>
          </Show>
        </box>
      </Show>
    </box>
  );
}

function getMaxSeconds(report: ReportResult): number {
  return Math.max(1, ...report.groups.map((g) => g.total_seconds));
}

function ReportBar(props: { group: ReportGroup; maxSeconds: number }) {
  const barLength = () =>
    Math.max(
      1,
      Math.round((props.group.total_seconds / props.maxSeconds) * BAR_WIDTH),
    );

  const bar = () =>
    "\u2588".repeat(barLength()) +
    "\u2591".repeat(BAR_WIDTH - barLength());

  const label = () => {
    const key = props.group.key || "(none)";
    return key.length > 16 ? key.slice(0, 15) + "\u2026" : key;
  };

  return (
    <box flexDirection="row">
      <text width={18} fg="#ffffff" attributes={1}>
        {label()}
      </text>
      <text fg="#06b6d4">{bar()}</text>
      <text marginLeft={1}>
        {formatDuration(props.group.total_seconds)}
      </text>
      <text fg="#6b7280" marginLeft={1}>
        ({props.group.entry_count})
      </text>
      <Show when={props.group.billable_amount != null}>
        <text fg="#22c55e" marginLeft={1}>
          ${props.group.billable_amount!.toFixed(2)} {props.group.currency}
        </text>
      </Show>
    </box>
  );
}
