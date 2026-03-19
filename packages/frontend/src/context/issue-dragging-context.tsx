import type { SerializedIssueSprint, SerializedIssueWithoutDescription } from "@blackwall/database";
import { createIssueDnD, IssueDnDContext, useIssueDnD } from "@/lib/issue-dnd";
import { m } from "@/paraglide/messages.js";
import {
  For,
  onCleanup,
  Show,
  type Accessor,
  type Component,
  type ParentComponent,
} from "solid-js";
import { Portal } from "solid-js/web";
import { SprintStatusBadge } from "@/components/sprints/sprint-status-badge";
import { formatDateShort } from "@/lib/dates";
import CalendarIcon from "lucide-solid/icons/calendar";

const DragOverlay: Component<{
  issues: SerializedIssueWithoutDescription[];
  x: number;
  y: number;
}> = (props) => {
  return (
    <Portal mount={document.body}>
      <div
        class="p-3 squircle-md border text-sm fixed top-0 left-0 bg-accent text-accent-foreground shadow-lg flex flex-row gap-2 items-center z-100 pointer-events-none"
        style={{
          "touch-action": "none",
          translate: `${props.x}px ${props.y}px`,
        }}
      >
        <Show
          when={props.issues.length > 1}
          fallback={
            <>
              <span class="text-muted-foreground">{props.issues[0]?.key}</span>
              <span>{props.issues[0]?.summary}</span>
            </>
          }
        >
          <span>{m.issue_dragging_overlay_count({ count: String(props.issues.length) })}</span>
        </Show>
      </div>
    </Portal>
  );
};

const SprintDropZone: Component<{ sprint: SerializedIssueSprint }> = (props) => {
  const { setDropZoneRef, removeDropZoneRef, dragState } = useIssueDnD();

  onCleanup(() => removeDropZoneRef(props.sprint.id));

  const count = () => dragState.draggedIssues.length;

  return (
    <div
      ref={(el) => setDropZoneRef(props.sprint.id, el)}
      class="bg-card squircle-md border border-dashed flex flex-col items-center justify-center px-6 py-4 gap-1.5 animate-in slide-in-from-bottom-4 fade-in-50 ease-out transition-shadow data-[drop-hover]:ring-2 data-[drop-hover]:ring-primary"
      data-dropzone
    >
      <div class="flex items-center gap-2">
        <span class="font-medium text-sm">{props.sprint.name}</span>
        <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarIcon class="size-3.5" />
          <span>
            {formatDateShort(new Date(props.sprint.startDate))} –{" "}
            {formatDateShort(new Date(props.sprint.endDate))}
          </span>
        </div>
        <SprintStatusBadge sprint={props.sprint} class="text-xs" />
      </div>
      <p class="text-xs text-muted-foreground mt-0.5">
        {m.issue_dragging_drop({ count: String(count()), sprintName: props.sprint.name })}
      </p>
    </div>
  );
};

type IssueDraggingProviderProps = {
  sprints: SerializedIssueSprint[];
  selectedIssues?: Accessor<SerializedIssueWithoutDescription[]>;
  onDrop?: (issues: SerializedIssueWithoutDescription[], sprint: SerializedIssueSprint) => void;
};

const IssueDraggingProvider: ParentComponent<IssueDraggingProviderProps> = (props) => {
  const dnd = createIssueDnD({
    sprints: () => props.sprints,
    getSelectedIssues: props.selectedIssues,
    onDrop: props.onDrop,
  });

  return (
    <IssueDnDContext.Provider value={dnd}>
      <Show when={dnd.dragState.draggedIssues.length > 0}>
        <DragOverlay
          issues={dnd.dragState.draggedIssues}
          x={dnd.dragState.cursorX}
          y={dnd.dragState.cursorY}
        />
        <div class="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center">
          <For each={props.sprints}>{(sprint) => <SprintDropZone sprint={sprint} />}</For>
        </div>
      </Show>
      {props.children}
    </IssueDnDContext.Provider>
  );
};

export { IssueDraggingProvider, useIssueDnD as useIssueDragCtx };
