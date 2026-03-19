import "../../../../test/env.test";
import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { jobService } from "@blackwall/queue";
import { workspaceData } from "../../../workspaces/workspace.data";
import { invitationData } from "../../invitation.data";
import { invitationService } from "../../invitation.service";

describe("invitationService", () => {
  afterEach(() => {
    mock.restore();
  });

  it("creates an invitation and enqueues an invite-email job", async () => {
    spyOn(workspaceData, "getWorkspaceById").mockResolvedValue({
      id: "ws-1",
      displayName: "Test Workspace",
      slug: "test-workspace",
    } as any);
    spyOn(invitationData, "createInvitation").mockResolvedValue({
      id: "inv-1",
      token: "test-token",
      workspaceId: "ws-1",
      email: "invitee@example.com",
      expiresAt: null,
    } as any);
    const addJobSpy = spyOn(jobService, "addJob").mockResolvedValue({} as any);

    const result = await invitationService.createInvitation({
      workspaceId: "ws-1",
      inviterId: "user-1",
      inviterName: "Inviter",
      email: "invitee@example.com",
    });

    expect(result.invitationUrl).toBe("http://localhost:8000/invite/test-token");
    expect(addJobSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "invite-email",
        payload: expect.objectContaining({
          email: "invitee@example.com",
          workspaceName: "Test Workspace",
          inviterName: "Inviter",
        }),
      }),
    );
  });

  it("returns null for an expired invitation", async () => {
    spyOn(invitationData, "getInvitationByToken").mockResolvedValue({
      id: "inv-1",
      token: "expired-token",
      expiresAt: new Date(Date.now() - 60_000),
      email: "test@example.com",
    } as any);

    const result = await invitationService.getInvitationByToken("expired-token");

    expect(result).toBeNull();
  });

  it("throws when accepting an invitation sent to a different email address", async () => {
    spyOn(invitationData, "getInvitationByToken").mockResolvedValue({
      id: "inv-1",
      token: "token",
      expiresAt: null,
      email: "correct@example.com",
      workspaceId: "ws-1",
      workspace: { slug: "test-ws" },
    } as any);

    let error: unknown;
    try {
      await invitationService.acceptInvitation({
        token: "token",
        userId: "user-1",
        userEmail: "wrong@example.com",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("This invitation was sent to a different email address");
  });

  it("accepts an invitation with case-insensitive email matching and adds the user", async () => {
    spyOn(invitationData, "getInvitationByToken").mockResolvedValue({
      id: "inv-1",
      token: "token",
      expiresAt: null,
      email: "invitee@example.com",
      workspaceId: "ws-1",
      workspace: { slug: "test-ws" },
    } as any);
    spyOn(workspaceData, "isWorkspaceMember").mockResolvedValue(false);
    const addUserSpy = spyOn(workspaceData, "addUserToWorkspace").mockResolvedValue({} as any);
    spyOn(invitationData, "deleteInvitation").mockResolvedValue(undefined);

    const result = await invitationService.acceptInvitation({
      token: "token",
      userId: "user-1",
      userEmail: "INVITEE@example.com",
    });

    expect(result).toEqual({ workspaceSlug: "test-ws" });
    expect(addUserSpy).toHaveBeenCalledWith({ userId: "user-1", workspaceId: "ws-1" });
  });

  it("does not add an already-existing member to the workspace again", async () => {
    spyOn(invitationData, "getInvitationByToken").mockResolvedValue({
      id: "inv-1",
      token: "token",
      expiresAt: null,
      email: "member@example.com",
      workspaceId: "ws-1",
      workspace: { slug: "test-ws" },
    } as any);
    spyOn(workspaceData, "isWorkspaceMember").mockResolvedValue(true);
    const addUserSpy = spyOn(workspaceData, "addUserToWorkspace").mockResolvedValue({} as any);
    spyOn(invitationData, "deleteInvitation").mockResolvedValue(undefined);

    await invitationService.acceptInvitation({
      token: "token",
      userId: "existing-member-id",
      userEmail: "member@example.com",
    });

    expect(addUserSpy).not.toHaveBeenCalled();
  });
});
