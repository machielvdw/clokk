import type { Accessor } from "solid-js";
import { Show } from "solid-js";
import type { StatusResult } from "@/core/types.ts";
import { formatDate } from "@/utils/date.ts";
import { formatDuration } from "@/utils/duration.ts";

interface TimerProps {
  status: Accessor<StatusResult>;
}

export function Timer(props: TimerProps) {
  return (
    <box
      flexDirection="column"
      border={true}
      borderStyle="rounded"
      borderColor="#22c55e"
      width="100%"
      padding={1}
    >
      <Show
        when={props.status().running}
        fallback={
          <box flexDirection="column" alignItems="center">
            <text fg="#6b7280">No timer running</text>
            <text fg="#6b7280">Press s to start a timer</text>
          </box>
        }
      >
        <box flexDirection="row" justifyContent="space-between">
          <text fg="#ffffff" attributes={1}>
            {props.status().entry?.description || "(no description)"}
          </text>
          <text fg="#22c55e" attributes={1}>
            {formatDuration(props.status().elapsed_seconds ?? 0)}
          </text>
        </box>

        <box flexDirection="row" gap={2} marginTop={1}>
          <Show when={props.status().entry?.project_id}>
            <text fg="#06b6d4">Project: {props.status().entry!.project_id}</text>
          </Show>
          <Show when={(props.status().entry?.tags.length ?? 0) > 0}>
            <text fg="#22c55e">Tags: {props.status().entry!.tags.join(", ")}</text>
          </Show>
          <Show when={props.status().entry?.billable}>
            <text fg="#eab308">$</text>
          </Show>
        </box>

        <text fg="#6b7280" marginTop={1}>
          Started: {formatDate(props.status().entry!.start_time)}
        </text>
      </Show>
    </box>
  );
}
