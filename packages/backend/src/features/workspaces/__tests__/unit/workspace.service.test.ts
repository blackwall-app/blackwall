import "../../../../test/env.test";
import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { ForbiddenError } from "../../../../lib/errors";
import { workspaceData } from "../../workspace.data";
import { workspaceService } from "../../workspace.service";

describe("workspaceService", () => {
  afterEach(() => {
    mock.restore();
  });

  it("returns a workspace to a member", async () => {
    const workspace = { id: "ws-1", slug: "test-ws", displayName: "Test" } as any;
    spyOn(workspaceData, "getWorkspaceBySlug").mockResolvedValue(workspace);
    spyOn(workspaceData, "isWorkspaceMember").mockResolvedValue(true);

    const result = await workspaceService.getWorkspaceBySlug("test-ws", "user-1");

    expect(result.id).toBe("ws-1");
  });

  it("throws ForbiddenError when a non-member requests a workspace", async () => {
    spyOn(workspaceData, "getWorkspaceBySlug").mockResolvedValue({ id: "ws-1" } as any);
    spyOn(workspaceData, "isWorkspaceMember").mockResolvedValue(false);

    let error: unknown;
    try {
      await workspaceService.getWorkspaceBySlug("test-ws", "outsider-id");
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ForbiddenError);
  });

  it("throws ForbiddenError when a non-member tries to add someone to a workspace", async () => {
    spyOn(workspaceData, "isWorkspaceMember").mockResolvedValue(false);

    let error: unknown;
    try {
      await workspaceService.addUserToWorkspace({
        actorId: "outsider-id",
        userId: "target-id",
        workspaceId: "ws-1",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ForbiddenError);
  });

  it("returns the last workspace when lastWorkspaceId is set", async () => {
    const workspace = { id: "ws-2", slug: "second-ws" } as any;
    spyOn(workspaceData, "getWorkspaceById").mockResolvedValue(workspace);

    const result = await workspaceService.getPreferredWorkspaceForUser({
      user: { id: "user-1", lastWorkspaceId: "ws-2" },
    });

    expect(result?.id).toBe("ws-2");
  });

  it("returns null when the user has no workspaces", async () => {
    spyOn(workspaceData, "getFirstWorkspaceForUser").mockResolvedValue(undefined);

    const result = await workspaceService.getPreferredWorkspaceForUser({
      user: { id: "user-1", lastWorkspaceId: null },
    });

    expect(result).toBeNull();
  });
});
