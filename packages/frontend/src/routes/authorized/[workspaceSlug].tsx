import { WorkspaceDataContext } from "@/context/workspace-context";
import { createAsync, useParams } from "@solidjs/router";
import { workspaceLoader } from "./[workspaceSlug].data";
import type { ParentComponent } from "solid-js";
import { Show } from "solid-js";
import { createEffect } from "solid-js";

const WorkspaceProvider: ParentComponent = (props) => {
  const params = useParams();
  const workspaceData = createAsync(() => workspaceLoader(params.workspaceSlug!));

  createEffect(() => {
    window.__workspaceSlug = params.workspaceSlug!;
  });

  return (
    <Show when={workspaceData()}>
      {(workspaceData) => (
        <WorkspaceDataContext.Provider value={workspaceData}>
          {props.children}
        </WorkspaceDataContext.Provider>
      )}
    </Show>
  );
};

export default WorkspaceProvider;
