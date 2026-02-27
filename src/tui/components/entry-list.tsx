import { For, Show } from "solid-js";
import type { Accessor } from "solid-js";
import type { Entry } from "@/core/types.ts";
import { formatDuration } from "@/utils/duration.ts";
import { formatDate } from "@/utils/date.ts";

interface EntryListProps {
  entries: Accessor<Entry[]>;
  total: Accessor<number>;
  page: Accessor<number>;
  pageSize: number;
  projectNames: Accessor<Map<string, string>>;
  selectedIndex: Accessor<number>;
  focused: Accessor<boolean>;
}

export function EntryList(props: EntryListProps) {
  const rangeStart = () => props.page() * props.pageSize + 1;
  const rangeEnd = () =>
    Math.min((props.page() + 1) * props.pageSize, props.total());

  return (
    <box
      flexDirection="column"
      border={true}
      borderStyle="single"
      borderColor={props.focused() ? "#06b6d4" : "#374151"}
      flexGrow={1}
      width="100%"
      title="Entries"
    >
      {/* Header */}
      <box flexDirection="row" paddingX={1}>
        <text fg="#9ca3af" attributes={1} width={30}>
          Description
        </text>
        <text fg="#9ca3af" attributes={1} width={14}>
          Project
        </text>
        <text fg="#9ca3af" attributes={1} width={18}>
          Start
        </text>
        <text fg="#9ca3af" attributes={1} width={10}>
          Duration
        </text>
      </box>

      {/* Entry rows */}
      <scrollbox flexGrow={1}>
        <For each={props.entries()}>
          {(entry, index) => (
            <EntryRow
              entry={entry}
              projectName={
                entry.project_id
                  ? (props.projectNames().get(entry.project_id) ?? null)
                  : null
              }
              selected={index() === props.selectedIndex()}
            />
          )}
        </For>
        <Show when={props.entries().length === 0}>
          <text fg="#6b7280" paddingX={1}>
            No entries found.
          </text>
        </Show>
      </scrollbox>

      {/* Pagination */}
      <Show when={props.total() > 0}>
        <box flexDirection="row" justifyContent="space-between" paddingX={1}>
          <text fg="#6b7280">
            {rangeStart()}-{rangeEnd()} of {props.total()}
          </text>
          <text fg="#6b7280">
            {props.page() > 0 ? "N:prev " : ""}
            {rangeEnd() < props.total() ? "n:next" : ""}
          </text>
        </box>
      </Show>
    </box>
  );
}

interface EntryRowProps {
  entry: Entry;
  projectName: string | null;
  selected: boolean;
}

function EntryRow(props: EntryRowProps) {
  const desc = () => {
    const d = props.entry.description || "(no description)";
    return d.length > 28 ? d.slice(0, 27) + "\u2026" : d;
  };

  const duration = () => {
    if (props.entry.end_time && props.entry.duration_seconds != null) {
      return formatDuration(props.entry.duration_seconds);
    }
    return "running\u2026";
  };

  return (
    <box
      flexDirection="row"
      paddingX={1}
      backgroundColor={props.selected ? "#1e3a5f" : undefined}
    >
      <text
        width={30}
        fg={props.selected ? "#ffffff" : undefined}
        truncate={true}
      >
        {desc()}
      </text>
      <text width={14} fg={props.projectName ? "#06b6d4" : "#6b7280"}>
        {props.projectName ?? "-"}
      </text>
      <text width={18}>{formatDate(props.entry.start_time)}</text>
      <text width={10} fg={props.entry.end_time ? undefined : "#eab308"}>
        {duration()}
      </text>
    </box>
  );
}
