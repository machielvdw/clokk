import { createSignal, onCleanup } from "solid-js";
import type { StatusResult } from "@/core/types.ts";
import { getStatus } from "@/core/timer.ts";
import { useRepo } from "@/tui/hooks/use-repo.ts";

const POLL_INTERVAL_MS = 200;

export function useTimer() {
  const repo = useRepo();
  const [status, setStatus] = createSignal<StatusResult>({ running: false });

  const poll = async () => {
    try {
      const result = await getStatus(repo);
      setStatus(result);
    } catch {
      // Swallow poll errors to keep the TUI running
    }
  };

  poll();
  const intervalId = setInterval(poll, POLL_INTERVAL_MS);
  onCleanup(() => clearInterval(intervalId));

  return status;
}
