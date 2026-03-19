import type { IssueStatus } from "@blackwall/database/schema";
import { createContext, createSignal, type JSX, onCleanup, onMount, useContext } from "solid-js";
import { useKeybinds } from "./keybind.context";
import { CreateDialogContent } from "../components/blocks/create-dialog";
import { Dialog } from "../components/ui/dialog";

export type CreateDialogDefaults = {
  status?: IssueStatus;
  teamKey?: string;
  assignedToId?: string;
  sprintId?: string | null;
};

type CreateDialogContextType = {
  open: (defaults?: CreateDialogDefaults) => void;
};

const CreateDialogContext = createContext<CreateDialogContextType>();

export function CreateDialogProvider(props: { children: JSX.Element }) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [defaults, setDefaults] = createSignal<CreateDialogDefaults>({});
  const { addKeybind, removeKeybind } = useKeybinds();

  onMount(() => {
    addKeybind("c r", () => {
      if (isOpen()) return;
      setIsOpen(true);
    });

    onCleanup(() => {
      removeKeybind("c r");
    });
  });

  function open(d?: CreateDialogDefaults) {
    setDefaults(d ?? {});
    setIsOpen(true);
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) {
      setDefaults({});
    }
  }

  return (
    <CreateDialogContext.Provider value={{ open }}>
      {props.children}
      <Dialog open={isOpen()} onOpenChange={handleOpenChange}>
        <CreateDialogContent defaults={defaults()} />
      </Dialog>
    </CreateDialogContext.Provider>
  );
}

export function useCreateDialog() {
  const context = useContext(CreateDialogContext);
  if (!context) {
    throw new Error("useCreateDialog must be used within a CreateDialogProvider.");
  }
  return context;
}
