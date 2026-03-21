import "../../../../test/env.test";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rmSync } from "node:fs";
import { cleanupTestDb, createTestDb, type TestDb } from "../../../../test/setup";
import {
  addUserToWorkspace,
  createIssue,
  createUser,
  seedTestSetup,
} from "../../../../test/fixtures";
import { attachmentService } from "../../attachment.service";
import { env } from "../../../../lib/zod-env";
import { NotFoundError } from "../../../../lib/errors";

describe("attachmentService", () => {
  let testDb: TestDb;
  let workspaceId: string;
  let workspaceSlug: string;
  let teamId: string;
  let teamKey: string;
  let userId: string;

  beforeEach(async () => {
    rmSync(env.FILES_DIR, { recursive: true, force: true });
    testDb = await createTestDb();

    const { workspace, team, user } = await seedTestSetup(testDb);
    workspaceId = workspace.id;
    workspaceSlug = workspace.slug;
    teamId = team.id;
    teamKey = team.key;
    userId = user.id;
  });

  afterEach(() => {
    cleanupTestDb(testDb);
    rmSync(env.FILES_DIR, { recursive: true, force: true });
  });

  it("uploads an attachment directly onto an issue and records a change event", async () => {
    const issue = await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      key: `${teamKey}-301`,
      keyNumber: 301,
      summary: "Attachment issue",
    });

    const attachment = await attachmentService.uploadAttachment({
      workspaceSlug,
      workspaceId,
      issueKey: issue.key,
      userId,
      file: new File(["image-bytes"], "screenshot.png", { type: "image/png" }),
    });

    expect(attachment.issueId).toBe(issue.id);
    expect(attachment.originalFileName).toBe("screenshot.png");
    expect(await Bun.file(attachment.filePath).exists()).toBe(true);

    const issueEvents = await testDb.db.query.issueChangeEvent.findMany({
      where: {
        issueId: issue.id,
      },
    });

    expect(
      issueEvents.some(
        (event) =>
          event.eventType === "attachment_added" && event.relatedEntityId === attachment.id,
      ),
    ).toBe(true);
  });

  it("uploads orphan attachments when no issue key is provided", async () => {
    const attachment = await attachmentService.uploadAttachment({
      workspaceSlug,
      workspaceId,
      issueKey: null,
      userId,
      file: new File(["draft"], "draft.png", { type: "image/png" }),
    });

    expect(attachment.issueId).toBeNull();
    expect(await Bun.file(attachment.filePath).exists()).toBe(true);
  });

  it("allows the orphan owner to download the attachment and rejects other users", async () => {
    const attachment = await attachmentService.uploadAttachment({
      workspaceSlug,
      workspaceId,
      issueKey: null,
      userId,
      file: new File(["draft"], "draft.png", { type: "image/png" }),
    });

    const ownedAttachment = await attachmentService.getAttachmentForDownload({
      userId,
      attachmentId: attachment.id,
    });
    expect(ownedAttachment.id).toBe(attachment.id);

    const outsider = await createUser(testDb, {
      email: "outsider-attachment@example.com",
      name: "Outsider",
    });

    let error: unknown;
    try {
      await attachmentService.getAttachmentForDownload({
        userId: outsider.id,
        attachmentId: attachment.id,
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as NotFoundError).statusCode).toBe(404);
  });

  it("allows any workspace member to download an issue attachment", async () => {
    const issue = await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      key: `${teamKey}-302`,
      keyNumber: 302,
      summary: "Shared attachment issue",
    });

    const attachment = await attachmentService.uploadAttachment({
      workspaceSlug,
      workspaceId,
      issueKey: issue.key,
      userId,
      file: new File(["image-bytes"], "shared.png", { type: "image/png" }),
    });

    const workspaceMember = await createUser(testDb, {
      email: "member-attachment@example.com",
      name: "Workspace Member",
    });
    await addUserToWorkspace(testDb, {
      userId: workspaceMember.id,
      workspaceId,
    });

    const downloadableAttachment = await attachmentService.getAttachmentForDownload({
      userId: workspaceMember.id,
      attachmentId: attachment.id,
    });

    expect(downloadableAttachment.id).toBe(attachment.id);
  });
});
