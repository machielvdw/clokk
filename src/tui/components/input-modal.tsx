import { Show } from "solid-js";
import type { Accessor } from "solid-js";
import type { InputRenderable } from "@opentui/core";
import { InputRenderableEvents } from "@opentui/core";

interface InputModalProps {
  title: string;
  placeholder?: string;
  visible: Accessor<boolean>;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function InputModal(props: InputModalProps) {
  function handleRef(el: InputRenderable) {
    el.on(InputRenderableEvents.ENTER, () => {
      const value = el.value.trim();
      if (value) {
        el.value = "";
        props.onSubmit(value);
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
        width="60%"
        height={4}
        title={props.title}
      >
        <input
          ref={handleRef}
          focused={true}
          placeholder={props.placeholder ?? ""}
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
