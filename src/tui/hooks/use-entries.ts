import { createSignal, onCleanup } from "solid-js";
import { listEntries } from "@/core/entries.ts";
import type { Entry } from "@/core/types.ts";
import { useRepo } from "@/tui/hooks/use-repo.ts";

const PAGE_SIZE = 20;
const REFRESH_INTERVAL_MS = 2000;

export function useEntries() {
  const repo = useRepo();
  const [entries, setEntries] = createSignal<Entry[]>([]);
  const [total, setTotal] = createSignal(0);
  const [page, setPage] = createSignal(0);
  const [projectNames, setProjectNames] = createSignal<Map<string, string>>(new Map());

  async function refresh() {
    try {
      const result = await listEntries(repo, {
        limit: PAGE_SIZE,
        offset: page() * PAGE_SIZE,
      });
      setEntries(result.entries);
      setTotal(result.total);

      // Resolve project names for display
      const nameMap = new Map<string, string>();
      const projectIds = new Set(
        result.entries.map((e) => e.project_id).filter((id): id is string => id != null),
      );
      for (const pid of projectIds) {
        const project = await repo.getProject(pid);
        if (project) nameMap.set(pid, project.name);
      }
      setProjectNames(nameMap);
    } catch {
      // Swallow errors to keep the TUI running
    }
  }

  refresh();
  const intervalId = setInterval(refresh, REFRESH_INTERVAL_MS);
  onCleanup(() => clearInterval(intervalId));

  function nextPage() {
    if ((page() + 1) * PAGE_SIZE < total()) {
      setPage((p) => p + 1);
      refresh();
    }
  }

  function prevPage() {
    if (page() > 0) {
      setPage((p) => p - 1);
      refresh();
    }
  }

  return {
    entries,
    total,
    page,
    projectNames,
    nextPage,
    prevPage,
    refresh,
    pageSize: PAGE_SIZE,
  };
}
