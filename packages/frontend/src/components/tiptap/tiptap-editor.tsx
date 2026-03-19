import { Editor, type Content } from "@tiptap/core";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { StarterKit } from "@tiptap/starter-kit";
import { cva, type VariantProps } from "class-variance-authority";
import CodeIcon from "lucide-solid/icons/code";
import Heading1Icon from "lucide-solid/icons/heading-1";
import Heading2Icon from "lucide-solid/icons/heading-2";
import ImageIcon from "lucide-solid/icons/image";
import ListIcon from "lucide-solid/icons/list";
import ListOrderedIcon from "lucide-solid/icons/list-ordered";
import QuoteIcon from "lucide-solid/icons/quote";
import { createEffect, createSignal, mergeProps, on, onCleanup, Show } from "solid-js";
import { BubbleMenu } from "./bubble-menu";
import { SlashCommand, type SlashCommandItem } from "./extensions/slash-command";
import { createSuggestionRenderer } from "./suggestion-renderer";
import { backendUrl } from "@/lib/env";
import { m } from "@/paraglide/messages.js";

export type TiptapProps = {
  initialContent?: Content;
  onAttachmentUpload?: (file: File) => Promise<{ id: string } | null>;
  editorRef?: (editor: Editor) => void;
  workspaceSlug?: string;
  placeholder?: string;
  class?: string;
  editable?: boolean;
  onPointerDown?: (e: PointerEvent) => void;
  testId?: string;
};

const tiptapVariants = cva("", {
  variants: {
    variant: {
      plain: "prose outline-none",
      input:
        "prose border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
    },
  },
  defaultVariants: {
    variant: "input",
  },
});

export const TiptapEditor = (props: TiptapProps & VariantProps<typeof tiptapVariants>) => {
  const merged = mergeProps(
    {
      editable: true,
    },
    props,
  );

  const [element, setElement] = createSignal<HTMLDivElement | null>(null);
  const [editor, setEditor] = createSignal<Editor | null>(null);

  const triggerFileUpload = (editor: Editor, range: { from: number; to: number }) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !merged.onAttachmentUpload) return;

      editor.chain().focus().deleteRange(range).run();

      const result = await merged.onAttachmentUpload(file);
      if (result) {
        editor
          .chain()
          .focus()
          .setImage({
            src: `${backendUrl}/api/issues/attachments/${result.id}/download`,
          })
          .run();
      }
    };
    input.click();
  };

  const getSlashCommandItems = (query: string): SlashCommandItem[] => {
    const items: SlashCommandItem[] = [
      {
        title: m.tiptap_slash_image_title(),
        description: m.tiptap_slash_image_description(),
        icon: () => <ImageIcon class="size-4" />,
        command: ({ editor, range }) => triggerFileUpload(editor, range),
      },
      {
        title: m.tiptap_slash_heading_1_title(),
        description: m.tiptap_slash_heading_1_description(),
        icon: () => <Heading1Icon class="size-4" />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
        },
      },
      {
        title: m.tiptap_slash_heading_2_title(),
        description: m.tiptap_slash_heading_2_description(),
        icon: () => <Heading2Icon class="size-4" />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
        },
      },
      {
        title: m.tiptap_slash_bullet_list_title(),
        description: m.tiptap_slash_bullet_list_description(),
        icon: () => <ListIcon class="size-4" />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
      },
      {
        title: m.tiptap_slash_numbered_list_title(),
        description: m.tiptap_slash_numbered_list_description(),
        icon: () => <ListOrderedIcon class="size-4" />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        },
      },
      {
        title: m.tiptap_slash_code_block_title(),
        description: m.tiptap_slash_code_block_description(),
        icon: () => <CodeIcon class="size-4" />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
      },
      {
        title: m.tiptap_slash_quote_title(),
        description: m.tiptap_slash_quote_description(),
        icon: () => <QuoteIcon class="size-4" />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        },
      },
    ];

    if (!query) return items;

    return items.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()));
  };

  createEffect(
    on(element, (element) => {
      const suggestionRenderer = createSuggestionRenderer();
      const editorInstance = new Editor({
        element: element,
        extensions: [
          StarterKit.configure({
            trailingNode: false,
          }),
          Image,
          Placeholder.configure({ placeholder: merged.placeholder }),
          Placeholder.configure({
            placeholder: m.tiptap_slash_hint(),
            dataAttribute: "slash-hint",
          }),
          SlashCommand.configure({
            suggestion: {
              items: ({ query }) => getSlashCommandItems(query),
              render: () => suggestionRenderer,
            },
          }),
        ],
        content: merged.initialContent,
        enableContentCheck: true,
        editable: merged.editable,
        editorProps: {
          attributes: {
            class: tiptapVariants({
              variant: merged.variant,
              class: merged.class,
            }),
          },
        },
      });

      setEditor(editorInstance);
      merged.editorRef?.(editorInstance);
    }),
  );

  createEffect(() => {
    editor()?.setEditable(merged.editable);
  });

  // makes initial content reactive
  createEffect(() => {
    if (merged.initialContent) {
      editor()
        ?.chain()
        .setContent(merged.initialContent, {
          emitUpdate: false,
        })
        .run();
    }
  });

  onCleanup(() => {
    editor()?.destroy();
  });

  return (
    <>
      <div
        ref={(el) => {
          setElement(el);
        }}
        class="w-full h-full"
        onPointerDown={props.onPointerDown}
        data-testid={merged.testId}
      />
      <Show when={merged.editable && editor()}>{(e) => <BubbleMenu editor={e()} />}</Show>
    </>
  );
};
