import type { Issue, SerializedIssue } from "@blackwall/database/schema";
import { api } from "@/lib/api";
import { m } from "@/paraglide/messages.js";
import { useNavigate } from "@solidjs/router";
import EllipsisIcon from "lucide-solid/icons/ellipsis";
import TrashIcon from "lucide-solid/icons/trash-2";
import { createSignal } from "solid-js";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

type IssueMenuProps = {
  issue: SerializedIssue;
  workspaceSlug: string;
  teamKey: string;
};

export function IssueMenu(props: IssueMenuProps) {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = createSignal(false);

  const handleDelete = async () => {
    await api.api.issues[":issueKey"].$delete({
      param: { issueKey: props.issue.key },
    });

    navigate(`/${props.workspaceSlug}/team/${props.teamKey}/issues`);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          as={Button}
          variant="ghost"
          size="iconXs"
          aria-label={m.common_more()}
          data-testid="issue-menu-trigger"
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
            <AlertDialogTitle>{m.issue_menu_delete_title()}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.issue_menu_delete_description({ issueKey: props.issue.key })}
            </AlertDialogDescription>
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
