import type { SerializedIssue } from "@blackwall/database/schema";
import { api } from "@/lib/api";
import { createSignal } from "solid-js";
import { action, reload, useAction } from "@solidjs/router";
import { toast } from "../custom-ui/toast";
import { IssueEditButtons } from "./issue-edit-buttons";
import { m } from "@/paraglide/messages.js";

const changeSummaryAction = action(async (issueKey: string, summary: string) => {
  await api.api.issues[":issueKey"].$patch({
    param: { issueKey },
    json: { summary },
  });

  throw reload({ revalidate: [] });
});

export function IssueSummary(props: { issue: SerializedIssue }) {
  // oxlint-disable-next-line no-unassigned-vars
  let h1Ref!: HTMLHeadingElement;
  const _changeSummaryAction = useAction(changeSummaryAction);
  const [isEditing, setIsEditing] = createSignal(false);
  const [summary, setSummary] = createSignal(props.issue.summary);

  async function handleSave() {
    if (summary() !== props.issue.summary) {
      await _changeSummaryAction(props.issue.key, summary());
      toast.success(m.issue_summary_toast_updated());
    }

    setIsEditing(false);
    h1Ref.blur();
  }

  function handleCancel() {
    setIsEditing(false);
    h1Ref.innerText = props.issue.summary;
    h1Ref.blur();
  }

  function handleInput(e: InputEvent) {
    const target = e.currentTarget as HTMLInputElement;
    setSummary(target.textContent);
    if (!isEditing()) {
      setIsEditing(true);
    }
  }

  function handlePaste(e: ClipboardEvent) {
    e.preventDefault();
    const target = e.currentTarget as HTMLInputElement;
    const text = e.clipboardData?.getData("text/plain") ?? "";
    target.textContent = text;
    setSummary(text);
  }

  return (
    <div class="relative">
      <h1
        ref={h1Ref}
        contentEditable={true}
        data-testid="issue-summary-input"
        class="w-full text-xl sm:text-2xl font-medium outline-none"
        onInput={handleInput}
        onPaste={handlePaste}
        spellcheck="false"
      >
        {props.issue.summary}
      </h1>

      <IssueEditButtons isEditing={isEditing()} onSave={handleSave} onCancel={handleCancel} />
    </div>
  );
}
