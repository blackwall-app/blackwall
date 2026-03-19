import ArchiveIcon from "lucide-solid/icons/archive";
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
} from "@/components/ui/alert-dialog";
import { m } from "@/paraglide/messages.js";

type ArchiveSprintDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
};

export function ArchiveSprintDialog(props: ArchiveSprintDialogProps) {
  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia class="bg-destructive/50">
            <ArchiveIcon class="size-4" />
          </AlertDialogMedia>
          <AlertDialogTitle>{m.archive_sprint_dialog_title()}</AlertDialogTitle>
          <AlertDialogDescription>{m.archive_sprint_dialog_description()}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel size="xs">{m.common_cancel()}</AlertDialogCancel>
          <AlertDialogAction size="xs" variant="destructive" action={props.onConfirm}>
            {m.archive_sprint_dialog_confirm()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
