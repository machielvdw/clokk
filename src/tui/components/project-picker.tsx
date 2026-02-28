import type { SelectOption, SelectRenderable } from "@opentui/core";
import { SelectRenderableEvents } from "@opentui/core";
import type { Accessor } from "solid-js";
import { createEffect, createSignal, Show } from "solid-js";
import { listProjects } from "@/core/projects.ts";
import type { Project } from "@/core/types.ts";
import { useRepo } from "@/tui/hooks/use-repo.ts";

interface ProjectPickerProps {
  visible: Accessor<boolean>;
  onSelect: (project: Project | null) => void;
  onCancel: () => void;
}

export function ProjectPicker(props: ProjectPickerProps) {
  const repo = useRepo();
  const [options, setOptions] = createSignal<SelectOption[]>([]);
  const [projects, setProjects] = createSignal<Project[]>([]);

  // Load projects when picker becomes visible
  createEffect(() => {
    if (!props.visible()) return;

    listProjects(repo)
      .then((result) => {
        setProjects(result);
        setOptions([
          { name: "(none)", description: "No project", value: null },
          ...result.map((p) => ({
            name: p.name,
            description: p.client ?? "",
            value: p.id,
          })),
        ]);
      })
      .catch(() => {});
  });

  function handleRef(el: SelectRenderable) {
    el.on(SelectRenderableEvents.ITEM_SELECTED, (_index: number, option: SelectOption | null) => {
      if (!option || option.value === null) {
        props.onSelect(null);
      } else {
        const project = projects().find((p) => p.id === option.value) ?? null;
        props.onSelect(project);
      }
    });
  }

  return (
    <Show when={props.visible()}>
      <box
        flexDirection="column"
        border={true}
        borderStyle="rounded"
        borderColor="#eab308"
        padding={1}
        width="50%"
        height={12}
        title="Select Project (Esc to skip)"
      >
        <select
          ref={handleRef}
          focused={true}
          options={options()}
          selectedIndex={0}
          wrapSelection={true}
          onKeyDown={(key) => {
            if (key.name === "escape") {
              props.onCancel();
            }
          }}
        />
      </box>
    </Show>
  );
}
