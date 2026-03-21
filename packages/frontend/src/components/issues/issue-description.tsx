import { TiptapEditor } from "@/components/tiptap/tiptap-editor";
import { useWorkspaceData } from "@/context/workspace-context";
import type { SerializedIssue } from "@blackwall/database/schema";
import { api, apiFetch } from "@/lib/api";
import type { Editor, JSONContent } from "@tiptap/core";
import { createEffect, createSignal } from "solid-js";
import { IssueEditButtons } from "./issue-edit-buttons";
import { action, reload, useAction } from "@solidjs/router";
import { m } from "@/paraglide/messages";

const changeDescriptionAction = action(async (issueKey: string, description: JSONContent) => {
  await api.api.issues[":issueKey"].$patch({
    param: { issueKey },
    json: { description },
  });

  throw reload({ revalidate: [] });
});

export function IssueDescription(props: { issue: SerializedIssue }) {
  const workspaceData = useWorkspaceData();
  const _changeDescriptionAction = useAction(changeDescriptionAction);
  const [editor, setEditor] = createSignal<Editor | null>(null);
  const [isEditing, setIsEditing] = createSignal(false);

  createEffect(() => {
    editor()?.on("update", () => {
      if (!isEditing()) {
        setIsEditing(true);
      }
    });
  });

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

  const handleSave = async () => {
    if (!editor()) {
      return;
    }

    await _changeDescriptionAction(props.issue.key, editor()!.getJSON());
    setIsEditing(false);
    editor()?.chain().blur().run();
  };

  const handleCancel = () => {
    editor()?.chain().setContent(props.issue.description).run();
    setIsEditing(false);
    editor()?.chain().blur().run();
  };

  return (
    <div class="pt-6 relative" data-testid="issue-description">
      <TiptapEditor
        editorRef={setEditor}
        initialContent={props.issue.description}
        onAttachmentUpload={handleUpload}
        workspaceSlug={workspaceData().workspace.slug}
        variant="plain"
        testId="issue-description-editor"
        placeholder={m.issue_description_placeholder()}
      />

      <IssueEditButtons isEditing={isEditing()} onSave={handleSave} onCancel={handleCancel} />
    </div>
  );
}
