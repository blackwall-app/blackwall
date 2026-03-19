import { AssigneePickerPopover, StatusPickerPopover } from "@/components/issues/pickers";
import { useAppForm } from "@/context/form-context";
import type {
  IssueStatus,
  SerializedIssueAttachment,
  SerializedTeam,
} from "@blackwall/database/schema";
import { useDialogContext } from "@kobalte/core/dialog";
import { Popover } from "@kobalte/core/popover";
import type { Editor, JSONContent } from "@tiptap/core";
import XIcon from "lucide-solid/icons/x";
import Users2Icon from "lucide-solid/icons/users-2";
import { createEffect, createSignal, mergeProps, on, onCleanup, Show } from "solid-js";
import * as z from "zod";
import { useWorkspaceData } from "../../context/workspace-context";
import { TeamAvatar } from "../custom-ui/avatar";
import { PickerPopover } from "../custom-ui/picker-popover";
import { TiptapEditor } from "../tiptap/tiptap-editor";
import { Button } from "../ui/button";
import {
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogSingleLineHeader,
  DialogTitle,
} from "../ui/dialog";
import { TanStackErrorMessages, TextField } from "../ui/text-field";
import {
  action,
  createAsync,
  json,
  query,
  redirect,
  useAction,
  useLocation,
} from "@solidjs/router";
import { api, apiFetch } from "@/lib/api";
import type { CreateIssue } from "@blackwall/backend/src/features/issues/issue.zod";
import type { CreateDialogDefaults } from "@/context/create-dialog.context";
import { m } from "@/paraglide/messages.js";

type CreateDialogContentProps = {
  defaults?: CreateDialogDefaults;
};

const getTeamUsers = query(async (teamKey: string) => {
  const res = await api.api.teams[":teamKey"].users.$get({
    param: {
      teamKey,
    },
  });

  const { users } = await res.json();

  return users;
}, "team-users");

const createIssueAction = action(
  async (issue: CreateIssue["issue"], workspaceSlug: string, teamKey: string) => {
    const res = await api.api.issues.$post({
      json: {
        issue,
        teamKey,
      },
    });

    const { issue: createdIssue } = await res.json();

    throw redirect(`/${workspaceSlug}/issue/${createdIssue.key}`, {
      revalidate: [],
    });
  },
);

const uploadAttachmentAction = action(async (formData: FormData) => {
  const res = await apiFetch(api.api.issues.attachments.$url(), {
    method: "POST",
    body: formData,
  });

  const { attachment } = (await res.json()) as { attachment: SerializedIssueAttachment };

  return json(attachment, { revalidate: [] });
});

function getTeamKeyFromPath(pathname: string) {
  const match = pathname.match(/\/team\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

function CreateDialogContent(props: CreateDialogContentProps) {
  const workspaceData = useWorkspaceData();
  const location = useLocation();
  const teams = () => workspaceData().teams;
  const contextualTeamKey = () => getTeamKeyFromPath(location.pathname);
  const merged = mergeProps(
    {
      status: "to_do" as IssueStatus,
      teamKey: "",
      assignedToId: null as string | null,
      sprintId: null as string | null,
    },
    () => {
      const defaults = props.defaults ?? {};

      return {
        status: defaults.status ?? "to_do",
        teamKey:
          defaults.teamKey ?? contextualTeamKey() ?? (teams().length === 1 ? teams()[0].key : ""),
        assignedToId: defaults.assignedToId ?? null,
        sprintId: defaults.sprintId ?? null,
      };
    },
  );

  const { isOpen, close } = useDialogContext();
  const [summaryInputElement, setSummaryInputElement] = createSignal<HTMLInputElement | null>(null);
  const _action = useAction(createIssueAction);
  const _uploadAttachmentAction = useAction(uploadAttachmentAction);
  const [editor, setEditor] = createSignal<Editor | null>(null);
  let resetTimeout: ReturnType<typeof setTimeout> | null = null;

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const attachment = await _uploadAttachmentAction(formData);
    return attachment;
  };

  const form = useAppForm(() => ({
    defaultValues: {
      teamKey: merged.teamKey,
      summary: "",
      description: undefined as unknown as JSONContent,
      status: merged.status,
      assignedToId: merged.assignedToId ?? null,
      sprintId: merged.sprintId ?? null,
    },
    onSubmit: async ({ value }) => {
      const { teamKey, ...issue } = value;
      await _action(issue, workspaceData().workspace.slug, teamKey);

      close();
      form.reset();
    },
    validators: {
      onSubmit: z.object({
        teamKey: z.string().min(1, m.create_dialog_team_key_required()),
        summary: z.string().min(1, m.create_dialog_summary_required()),
        status: z.enum(["to_do", "in_progress", "done"], {
          error: m.create_dialog_status_required(),
        }),
        description: z.any().refine((val) => val !== null && val !== undefined, {
          message: m.create_dialog_description_required(),
        }),
        assignedToId: z.string().nullable(),
        sprintId: z.string().nullable(),
      }),
    },
  }));
  const assignableUsers = createAsync(() => {
    const teamKey = form.state.values.teamKey;
    return teamKey ? getTeamUsers(teamKey) : Promise.resolve([]);
  });

  createEffect(
    on(
      [isOpen, summaryInputElement],
      ([open, summaryInputElement]) => {
        if (open) {
          if (resetTimeout) {
            clearTimeout(resetTimeout);
            resetTimeout = null;
          }

          form.setFieldValue("teamKey", merged.teamKey);
          form.setFieldValue("status", merged.status);
          form.setFieldValue("assignedToId", merged.assignedToId ?? null);
          form.setFieldValue("sprintId", merged.sprintId ?? null);

          if (summaryInputElement) {
            requestAnimationFrame(() => {
              summaryInputElement.focus();
            });
          }

          return;
        }

        if (!open) {
          if (resetTimeout) {
            clearTimeout(resetTimeout);
          }

          resetTimeout = setTimeout(() => {
            form.reset();
          }, 200);

          return;
        }
      },
      { defer: true },
    ),
  );

  onCleanup(() => {
    if (resetTimeout) {
      clearTimeout(resetTimeout);
      resetTimeout = null;
    }
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    e.stopPropagation();

    if (!editor()) {
      return;
    }

    const summaryInput = summaryInputElement();
    if (summaryInput) {
      // Keep submit resilient to fast "type + submit" flows by syncing the latest DOM value.
      form.setFieldValue("summary", summaryInput.value);
    }

    // Imperatively set the value of the description field just before submitting the form.
    // This way, we avoid serializing the editor content to JSON for each change.
    // This is very beneficial for performance.
    form.setFieldValue("description", editor()!.getJSON());

    await form.handleSubmit();
  };

  const handleTeamChange = (teamKey: string) => {
    form.setFieldValue("teamKey", teamKey);
    form.setFieldValue("assignedToId", null);
    form.setFieldValue("sprintId", null);
  };

  return (
    <DialogContent
      class="p-0 gap-0 max-h-screen overflow-auto"
      showCloseButton={false}
      onOpenAutoFocus={(e) => e.preventDefault()}
      data-testid="create-issue-dialog"
    >
      <DialogSingleLineHeader>
        <DialogTitle class="text-sm font-normal leading-none text-foreground">
          {m.create_dialog_title()}
        </DialogTitle>
        <DialogClose as={Button} class="p-px! h-auto!" variant="ghost">
          <XIcon class="size-4" />
        </DialogClose>
      </DialogSingleLineHeader>

      <form onSubmit={handleSubmit}>
        <div class="px-4 py-2 flex flex-col">
          <form.AppField name="summary">
            {(field) => (
              <TextField
                name={field().name}
                value={field().state.value}
                class="pb-3"
                validationState={field().state.meta.errors.length > 0 ? "invalid" : "valid"}
              >
                <TextField.Input
                  ref={setSummaryInputElement}
                  value={field().state.value}
                  onInput={(e: InputEvent) => {
                    const target = e.currentTarget as HTMLInputElement;
                    field().handleChange(target.value);
                  }}
                  onBlur={field().handleBlur}
                  placeholder={m.create_dialog_summary_placeholder()}
                  data-testid="create-issue-summary-input"
                  variant="unstyled"
                  class="text-xl"
                />
                <TanStackErrorMessages />
              </TextField>
            )}
          </form.AppField>

          <form.AppField name="description">
            {(field) => (
              <TextField
                name={field().name}
                validationState={field().state.meta.errors.length > 0 ? "invalid" : "valid"}
                class="pb-2"
              >
                <TiptapEditor
                  editorRef={setEditor}
                  initialContent={field().state.value}
                  onAttachmentUpload={handleUpload}
                  workspaceSlug={workspaceData().workspace.slug}
                  variant="plain"
                  placeholder={m.create_dialog_description_placeholder()}
                  class="min-h-24"
                  testId="create-issue-description-editor"
                />
                <TanStackErrorMessages />
              </TextField>
            )}
          </form.AppField>
        </div>

        <div class="px-4 py-2 flex flex-row gap-2 flex-wrap">
          <form.AppField name="teamKey">
            {(field) => (
              <TeamPicker teams={teams()} value={field().state.value} onChange={handleTeamChange} />
            )}
          </form.AppField>

          <form.AppField name="assignedToId">
            {(field) => (
              <AssigneePickerPopover
                small
                controlled
                assignableUsers={assignableUsers() ?? []}
                assignedToId={field().state.value}
                teamKey={form.state.values.teamKey}
                workspaceSlug={workspaceData().workspace.slug}
                handleChange={field().handleChange}
              />
            )}
          </form.AppField>

          <form.AppField name="status">
            {(field) => (
              <StatusPickerPopover
                controlled
                status={field().state.value}
                onChange={field().handleChange}
              />
            )}
          </form.AppField>
        </div>

        <DialogFooter class="px-4 py-3 border-t">
          <form.Subscribe>
            {(state) => (
              <Button
                type="submit"
                size="sm"
                data-testid="create-issue-submit-button"
                disabled={!state().canSubmit}
              >
                {m.create_dialog_submit()}
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function TeamPicker(props: {
  teams: SerializedTeam[];
  value: string;
  onChange: (teamKey: string) => void;
}) {
  const team = () => props.teams.find((candidate) => candidate.key === props.value);
  const options = () =>
    props.teams.map((team) => ({
      id: team.key,
      label: team.name,
      icon: () => <TeamAvatar team={team} size="5" />,
    }));

  return (
    <Popover>
      <Popover.Trigger as={Button} variant="outline" size="sm" class="pl-1 pr-2 py-1 h-auto">
        <Show
          when={team()}
          fallback={<Users2Icon class="size-4 text-muted-foreground shrink-0 mx-0.5" />}
        >
          {(selectedTeam) => <TeamAvatar team={selectedTeam()} size="5" />}
        </Show>
        <span class="truncate">{team()?.name ?? m.create_dialog_select_team()}</span>
      </Popover.Trigger>
      <PickerPopover
        options={options()}
        value={props.value || null}
        onChange={(value) => {
          if (value) {
            props.onChange(String(value));
          }
        }}
      />
    </Popover>
  );
}

export { CreateDialogContent };
export type { CreateDialogContentProps };
