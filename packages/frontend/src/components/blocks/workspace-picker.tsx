import { useWorkspaceData } from "@/context/workspace-context";
import { Popover } from "@kobalte/core/popover";
import SelectorIcon from "lucide-solid/icons/chevrons-up-down";
import { createSignal } from "solid-js";
import { PickerPopover } from "../custom-ui/picker-popover";
import { Button } from "../ui/button";
import { query, useNavigate } from "@solidjs/router";
import { api } from "@/lib/api";
import { createResource } from "solid-js";
import { m } from "@/paraglide/messages.js";

const workspacesQuery = query(async () => {
  const res = await api.api.workspaces.$get();

  const data = await res.json();

  return data;
}, "list-workspaces");

export function WorkspacePicker() {
  const [open, setOpen] = createSignal(false);
  const navigate = useNavigate();
  const workspaceData = useWorkspaceData();
  const [workspacesData] = createResource(() => workspacesQuery());

  const pickerOptions = () => {
    const workspaces = workspacesData()?.workspaces?.map((workspace) => ({
      id: workspace.id,
      label: workspace.displayName,
    }));

    return [
      ...(workspaces ?? []),
      {
        id: "create-workspace",
        label: m.either_create_workspace_title(),
      },
    ];
  };

  function handleChange(id: string) {
    if (id === "create-workspace") {
      navigate("/create-workspace");
    }
    const workspace = workspacesData()?.workspaces?.find((option) => option.id === id);
    if (!workspace) return;

    navigate(`/${workspace.slug}/my-issues`);
  }

  return (
    <Popover placement="bottom" gutter={8} open={open()} onOpenChange={setOpen}>
      <Popover.Trigger as={Button} variant="ghost" class="h-auto !px-1 !py-1 items-center">
        <span class="truncate font-medium">{workspaceData().workspace.displayName}</span>
        <SelectorIcon class="size-3.5 ml-1 shrink-0" />
      </Popover.Trigger>

      <PickerPopover
        options={pickerOptions()}
        value={workspaceData().workspace.id}
        loading={workspacesData.loading}
        onChange={handleChange}
        emptyText={m.workspace_picker_no_workspaces_found()}
      />
    </Popover>
  );
}
