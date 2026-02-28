import type { KeyEvent } from "@opentui/core";
import { useKeyboard } from "@opentui/solid";
import { createSignal, Show } from "solid-js";
import { ClokkError } from "@/core/errors.ts";
import { cancelTimer, resumeTimer, startTimer, stopTimer, switchTimer } from "@/core/timer.ts";
import type { Project } from "@/core/types.ts";
import { EntryList } from "@/tui/components/entry-list.tsx";
import { HelpOverlay } from "@/tui/components/help-overlay.tsx";
import { InputModal } from "@/tui/components/input-modal.tsx";
import { ProjectPicker } from "@/tui/components/project-picker.tsx";
import { ReportView } from "@/tui/components/report-view.tsx";
import { StatusBar } from "@/tui/components/status-bar.tsx";
import { Timer } from "@/tui/components/timer.tsx";
import { useEntries } from "@/tui/hooks/use-entries.ts";
import { useRepo } from "@/tui/hooks/use-repo.ts";
import { useReport } from "@/tui/hooks/use-report.ts";
import { useTimer } from "@/tui/hooks/use-timer.ts";

// Modal state machine:
//   none → start-desc → start-project → (startTimer) → none
//   none → switch-desc → switch-project → (switchTimer) → none
type ModalState =
  | { mode: "none" }
  | { mode: "start-desc" }
  | { mode: "start-project"; description: string }
  | { mode: "switch-desc" }
  | { mode: "switch-project"; description: string };

export function App() {
  const repo = useRepo();
  const status = useTimer();
  const {
    entries,
    total,
    page,
    projectNames,
    nextPage,
    prevPage,
    pageSize,
    refresh: refreshEntries,
  } = useEntries();
  const {
    report,
    period,
    setPeriod,
    groupBy,
    loading: reportLoading,
    navigateBack,
    navigateForward,
    resetToNow,
    cycleGroupBy,
    getDateRange,
  } = useReport();

  const [activeView, setActiveView] = createSignal<"timer" | "report">("timer");
  const [focusedPane, setFocusedPane] = createSignal<"timer" | "entries">("timer");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [modal, setModal] = createSignal<ModalState>({ mode: "none" });
  const [helpVisible, setHelpVisible] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  let errorTimeout: ReturnType<typeof setTimeout> | undefined;

  function showError(msg: string) {
    if (errorTimeout) clearTimeout(errorTimeout);
    setErrorMessage(msg);
    errorTimeout = setTimeout(() => setErrorMessage(null), 3000);
  }

  async function handleAction(action: () => Promise<unknown>) {
    try {
      await action();
      refreshEntries();
    } catch (err) {
      if (err instanceof ClokkError) {
        showError(err.message);
      } else {
        showError(String(err));
      }
    }
  }

  const isModalOpen = () => modal().mode !== "none";

  useKeyboard((key: KeyEvent) => {
    // Modal open — let modal components handle input
    if (isModalOpen()) return;

    // Help overlay consumes all keys except dismiss
    if (helpVisible()) {
      if (
        key.name === "escape" ||
        key.name === "q" ||
        key.name === "?" ||
        (key.shift && key.name === "/")
      ) {
        setHelpVisible(false);
      }
      return;
    }

    // Quit
    if ((key.ctrl && key.name === "c") || key.name === "q") {
      process.exit(0);
    }

    // Help
    if (key.name === "?" || (key.shift && key.name === "/")) {
      setHelpVisible(true);
      return;
    }

    // View switching: Shift+R
    if (key.shift && key.name === "r") {
      setActiveView((v) => (v === "timer" ? "report" : "timer"));
      return;
    }

    // Tab: toggle focus between timer and entries pane
    if (key.name === "tab") {
      setFocusedPane((p) => (p === "timer" ? "entries" : "timer"));
      return;
    }

    // Timer view shortcuts
    if (activeView() === "timer") {
      // Entry list navigation (when focused)
      if (focusedPane() === "entries") {
        if (key.name === "j" || key.name === "down") {
          setSelectedIndex((i) => Math.min(entries().length - 1, i + 1));
          return;
        }
        if (key.name === "k" || key.name === "up") {
          setSelectedIndex((i) => Math.max(0, i - 1));
          return;
        }
        if (key.name === "n" && !key.shift) {
          nextPage();
          setSelectedIndex(0);
          return;
        }
        if (key.name === "n" && key.shift) {
          prevPage();
          setSelectedIndex(0);
          return;
        }
      }

      // Timer actions (work from either pane)
      if (key.name === "s") {
        setModal({ mode: "start-desc" });
        return;
      }
      if (key.name === "x") {
        handleAction(() => stopTimer(repo));
        return;
      }
      if (key.name === "w") {
        setModal({ mode: "switch-desc" });
        return;
      }
      if (key.name === "r" && !key.shift) {
        handleAction(() => resumeTimer(repo));
        return;
      }
      if (key.name === "c") {
        handleAction(() => cancelTimer(repo));
        return;
      }
    }

    // Report view shortcuts
    if (activeView() === "report") {
      if (key.name === "h" || key.name === "left") {
        navigateBack();
        return;
      }
      if (key.name === "l" || key.name === "right") {
        navigateForward();
        return;
      }
      if (key.name === "d") {
        setPeriod("day");
        return;
      }
      if (key.name === "w") {
        setPeriod("week");
        return;
      }
      if (key.name === "m") {
        setPeriod("month");
        return;
      }
      if (key.name === "g") {
        cycleGroupBy();
        return;
      }
      if (key.name === "t") {
        resetToNow();
        return;
      }
    }
  });

  // Modal flow handlers
  function handleDescriptionSubmit(description: string) {
    const m = modal();
    if (m.mode === "start-desc") {
      setModal({ mode: "start-project", description });
    } else if (m.mode === "switch-desc") {
      setModal({ mode: "switch-project", description });
    }
  }

  function handleProjectSelect(project: Project | null) {
    const m = modal();
    setModal({ mode: "none" });

    if (m.mode === "start-project") {
      handleAction(() =>
        startTimer(repo, {
          description: m.description,
          project: project?.name,
        }),
      );
    } else if (m.mode === "switch-project") {
      handleAction(() =>
        switchTimer(repo, {
          description: m.description,
          project: project?.name,
        }),
      );
    }
  }

  function handleModalCancel() {
    setModal({ mode: "none" });
  }

  const showInputModal = () => {
    const m = modal().mode;
    return m === "start-desc" || m === "switch-desc";
  };

  const showProjectPicker = () => {
    const m = modal().mode;
    return m === "start-project" || m === "switch-project";
  };

  const inputModalTitle = () => (modal().mode === "start-desc" ? "Start timer" : "Switch to");

  return (
    <box flexDirection="column" width="100%" height="100%">
      {/* Main content */}
      <box flexGrow={1} flexDirection="column">
        <Show when={activeView() === "timer"}>
          {/* Timer pane: fixed height */}
          <box height={8}>
            <Timer status={status} />
          </box>

          {/* Entry list: fills remaining space */}
          <EntryList
            entries={entries}
            total={total}
            page={page}
            pageSize={pageSize}
            projectNames={projectNames}
            selectedIndex={selectedIndex}
            focused={() => focusedPane() === "entries"}
          />
        </Show>

        <Show when={activeView() === "report"}>
          <ReportView
            report={report}
            period={period}
            groupBy={groupBy}
            loading={reportLoading}
            getDateRange={getDateRange}
          />
        </Show>
      </box>

      {/* Modal overlays */}
      <InputModal
        title={inputModalTitle()}
        placeholder="What are you working on?"
        visible={showInputModal}
        onSubmit={handleDescriptionSubmit}
        onCancel={handleModalCancel}
      />

      <ProjectPicker
        visible={showProjectPicker}
        onSelect={handleProjectSelect}
        onCancel={() => handleProjectSelect(null)}
      />

      <HelpOverlay visible={helpVisible} />

      {/* Status bar */}
      <StatusBar activeView={activeView} errorMessage={errorMessage} />
    </box>
  );
}
