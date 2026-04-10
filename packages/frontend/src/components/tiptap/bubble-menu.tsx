import type { Editor } from "@tiptap/core";
import BoldIcon from "lucide-solid/icons/bold";
import CodeIcon from "lucide-solid/icons/code";
import ItalicIcon from "lucide-solid/icons/italic";
import StrikethroughIcon from "lucide-solid/icons/strikethrough";
import { createSignal, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

type BubbleMenuProps = {
  editor: Editor;
};

function getSelectionRect(): DOMRect | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  return selection.getRangeAt(0).getBoundingClientRect();
}

export function BubbleMenu(props: BubbleMenuProps) {
  const [rect, setRect] = createSignal<DOMRect | null>(null);
  const [isBold, setIsBold] = createSignal(false);
  const [isItalic, setIsItalic] = createSignal(false);
  const [isStrike, setIsStrike] = createSignal(false);
  const [isCode, setIsCode] = createSignal(false);

  const update = () => {
    const { empty } = props.editor.state.selection;
    if (empty) {
      setRect(null);
      return;
    }
    setRect(getSelectionRect());
    setIsBold(props.editor.isActive("bold"));
    setIsItalic(props.editor.isActive("italic"));
    setIsStrike(props.editor.isActive("strike"));
    setIsCode(props.editor.isActive("code"));
  };

  const hide = () => setRect(null);

  props.editor.on("selectionUpdate", update);
  props.editor.on("transaction", update);
  props.editor.on("blur", hide);

  onCleanup(() => {
    props.editor.off("selectionUpdate", update);
    props.editor.off("transaction", update);
    props.editor.off("blur", hide);
  });

  const buttonClass = (active: boolean) =>
    cn(
      "flex items-center justify-center size-7 rounded hover:bg-accent hover:text-accent-foreground transition-colors",
      active && "bg-accent text-accent-foreground",
    );

  return (
    <Show when={rect()}>
      {(r) => (
        <Portal>
          <div
            style={{
              position: "fixed",
              top: `${r().top - 44}px`,
              left: `${r().left + r().width / 2}px`,
              transform: "translateX(-50%)",
              "z-index": "200",
            }}
            class="flex items-center gap-0.5 rounded-md border bg-popover p-1 shadow-md"
            onMouseDown={(e) => e.preventDefault()}
          >
            <Tooltip>
              <TooltipTrigger
                as="button"
                type="button"
                class={buttonClass(isBold())}
                onMouseDown={(e: MouseEvent) => {
                  e.preventDefault();
                  props.editor.chain().focus().toggleBold().run();
                }}
              >
                <BoldIcon class="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>{m.tiptap_bubble_bold()}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                as="button"
                type="button"
                class={buttonClass(isItalic())}
                onMouseDown={(e: MouseEvent) => {
                  e.preventDefault();
                  props.editor.chain().focus().toggleItalic().run();
                }}
              >
                <ItalicIcon class="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>{m.tiptap_bubble_italic()}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                as="button"
                type="button"
                class={buttonClass(isStrike())}
                onMouseDown={(e: MouseEvent) => {
                  e.preventDefault();
                  props.editor.chain().focus().toggleStrike().run();
                }}
              >
                <StrikethroughIcon class="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>{m.tiptap_bubble_strike()}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                as="button"
                type="button"
                class={buttonClass(isCode())}
                onMouseDown={(e: MouseEvent) => {
                  e.preventDefault();
                  props.editor.chain().focus().toggleCode().run();
                }}
              >
                <CodeIcon class="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>{m.tiptap_bubble_code()}</TooltipContent>
            </Tooltip>
          </div>
        </Portal>
      )}
    </Show>
  );
}
