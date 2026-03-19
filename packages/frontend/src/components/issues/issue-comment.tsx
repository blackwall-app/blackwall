import type { InferDbType } from "@blackwall/database/types";
import { UserAvatar } from "../custom-ui/avatar";
import { formatRelative } from "@/lib/dates";
import { TiptapEditor } from "../tiptap/tiptap-editor";
import { createEffect, createSignal, Show } from "solid-js";
import { api, apiFetch } from "@/lib/api";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { action, reload, useAction } from "@solidjs/router";
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import EllipsisIcon from "lucide-solid/icons/ellipsis";
import TrashIcon from "lucide-solid/icons/trash-2";
import SendHorizontalIcon from "lucide-solid/icons/send-horizontal";
import { toast } from "../custom-ui/toast";
import type { JSONContent } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import { m } from "@/paraglide/messages.js";

type IssueWithCommentsAndEvents = InferDbType<
  "issue",
  {
    comments: {
      with: {
        author: true;
      };
    };
    changeEvents: {
      with: {
        actor: true;
      };
    };
  }
>;

type CommentWithAuthor = InferDbType<
  "issueComment",
  {
    author: true;
  }
>;

export type IssueCommentProps = {
  comment: CommentWithAuthor;
  issueKey: string;
  workspaceSlug: string;
};

export function IssueComment(props: IssueCommentProps) {
  return (
    <div
      class="p-4 squircle-lg bg-muted border flex flex-col gap-3.5"
      data-testid="issue-comment-item"
    >
      <div class="flex flex-row gap-1 items-center">
        <UserAvatar user={props.comment.author} size="xs" />
        <p class="font-medium">{props.comment.author.name}</p>
        <p class="text-muted-foreground ml-1">
          {formatRelative(props.comment.createdAt, new Date())}
        </p>
        <CommentMenu
          comment={props.comment}
          issueKey={props.issueKey}
          workspaceSlug={props.workspaceSlug}
        />
      </div>

      <Show when={props.comment.content}>
        {(content) => <TiptapEditor initialContent={content()} editable={false} variant="plain" />}
      </Show>
    </div>
  );
}

export type CommentMenuProps = {
  comment: CommentWithAuthor;
  issueKey: string;
  workspaceSlug: string;
};

const deleteCommentAction = action(async (issueKey: string, commentId: string) => {
  await api.api.issues[":issueKey"].comments[":commentId"].$delete({
    param: { issueKey, commentId },
  });
  toast.success(m.issue_comment_toast_deleted());

  throw reload({ revalidate: ["issueShow"] });
});

export function CommentMenu(props: CommentMenuProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = createSignal(false);
  const _action = useAction(deleteCommentAction);

  const handleDelete = async () => {
    await _action(props.issueKey, props.comment.id);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          as={Button}
          variant="ghost"
          size="iconXs"
          class="ml-auto"
          aria-label={m.common_more()}
        >
          <EllipsisIcon class="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteDialogOpen(true)}>
            <TrashIcon class="size-4" />
            {m.common_delete()}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteDialogOpen()} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia class="bg-destructive/50">
              <TrashIcon class="size-4" />
            </AlertDialogMedia>
            <AlertDialogTitle>{m.issue_comment_delete_title()}</AlertDialogTitle>
            <AlertDialogDescription>{m.issue_comment_delete_description()}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="xs">{m.common_cancel()}</AlertDialogCancel>
            <AlertDialogAction size="xs" variant="destructive" action={handleDelete}>
              {m.common_delete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export type IssueCommentFormProps = {
  issue: IssueWithCommentsAndEvents;
  workspaceSlug: string;
};

const createCommentAction = action(async (issueKey: string, content: JSONContent) => {
  await api.api.issues[":issueKey"].comments.$post({
    param: { issueKey },
    json: { content },
  });

  throw reload({ revalidate: ["issueShow"] });
});

export function IssueCommentForm(props: IssueCommentFormProps) {
  const [editor, setEditor] = createSignal<Editor | null>(null);
  const [empty, setEmpty] = createSignal(true);
  const _createCommentAction = useAction(createCommentAction);

  createEffect(() => {
    editor()?.on("update", ({ editor }) => {
      setEmpty(editor.isEmpty);
    });
  });

  const handleSubmit = async () => {
    if (!editor()) {
      return;
    }

    await _createCommentAction(props.issue.key, editor()!.getJSON());

    editor()!.chain().setContent("").run();
  };

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await apiFetch(
      api.api.issues[":issueKey"].attachments.$url({
        param: { issueKey: props.issue.key },
      }),
      {
        method: "POST",
        body: formData,
      },
    );
    const { attachment } = await res.json();
    return attachment;
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      class="relative"
      data-testid="issue-comment-form"
    >
      <TiptapEditor
        editorRef={setEditor}
        onAttachmentUpload={handleUpload}
        workspaceSlug={props.workspaceSlug}
        placeholder={m.issue_comment_placeholder()}
        variant="plain"
        class="min-h-24 p-4 squircle-lg bg-muted border"
        testId="issue-comment-editor"
      />

      <Button
        type="submit"
        size="sm"
        class="absolute bottom-4 right-4 px-1.5! aspect-square"
        aria-label={m.common_create()}
        data-testid="issue-comment-submit"
        disabled={empty()}
      >
        <SendHorizontalIcon class="size-4" />
      </Button>
    </form>
  );
}
