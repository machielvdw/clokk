import type { Accessor } from "solid-js";
import { Show } from "solid-js";

interface StatusBarProps {
  activeView: Accessor<"timer" | "report">;
  errorMessage: Accessor<string | null>;
}

export function StatusBar(props: StatusBarProps) {
  const shortcuts = () =>
    props.activeView() === "timer"
      ? "s:start  x:stop  w:switch  r:resume  c:cancel  R:report  ?:help  q:quit"
      : "h/l:navigate  d/w/m:period  g:group  t:today  R:timer  ?:help  q:quit";

  return (
    <box width="100%" height={1} flexDirection="row" justifyContent="space-between">
      <Show
        when={!props.errorMessage()}
        fallback={<text fg="#ef4444">{props.errorMessage()}</text>}
      >
        <text fg="#6b7280">{shortcuts()}</text>
      </Show>
      <text fg="#06b6d4">[{props.activeView() === "timer" ? "Timer" : "Report"}]</text>
    </box>
  );
}
