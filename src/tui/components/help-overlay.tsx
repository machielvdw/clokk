import { Show } from "solid-js";
import type { Accessor } from "solid-js";

interface HelpOverlayProps {
  visible: Accessor<boolean>;
}

export function HelpOverlay(props: HelpOverlayProps) {
  return (
    <Show when={props.visible()}>
      <box
        flexDirection="column"
        border={true}
        borderStyle="rounded"
        borderColor="#06b6d4"
        padding={1}
        width="40%"
        title="Keyboard Shortcuts"
      >
        <text fg="#ffffff" attributes={1}>
          Timer
        </text>
        <text fg="#d1d5db">{"  s   Start a new timer"}</text>
        <text fg="#d1d5db">{"  x   Stop the running timer"}</text>
        <text fg="#d1d5db">{"  w   Switch to a new task"}</text>
        <text fg="#d1d5db">{"  r   Resume the last timer"}</text>
        <text fg="#d1d5db">{"  c   Cancel the running timer"}</text>
        <text> </text>
        <text fg="#ffffff" attributes={1}>
          Navigation
        </text>
        <text fg="#d1d5db">{"  Tab Focus timer/entry list"}</text>
        <text fg="#d1d5db">{"  j/k Scroll entry list"}</text>
        <text fg="#d1d5db">{"  n/N Next/prev page"}</text>
        <text fg="#d1d5db">{"  R   Toggle report view"}</text>
        <text> </text>
        <text fg="#d1d5db">{"  ?   Toggle this help"}</text>
        <text fg="#d1d5db">{"  q   Quit"}</text>
      </box>
    </Show>
  );
}
