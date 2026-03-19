import { useIssueDragCtx } from "@/context/issue-dragging-context";
import type { ParentComponent } from "solid-js";

export const HideWhileDragging: ParentComponent = (props) => {
  const { dragState } = useIssueDragCtx();
  return <div class={dragState.isDragging ? "hidden" : "contents"}>{props.children}</div>;
};
