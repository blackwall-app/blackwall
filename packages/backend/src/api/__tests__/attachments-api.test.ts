import "../../test/env.test";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { dbSchema } from "@blackwall/database";
import { WORKSPACE_SLUG_HEADER } from "@blackwall/shared";
import { Effect } from "effect";
import { app } from "../../index";
import { handleApiRequest } from "../index";
import { AttachmentService } from "../../features/issues/AttachmentService";
import { runtime } from "../../lib/effect/runtime";
import { env } from "../../lib/env";
import { runApi } from "../../test/api";
import {
  addUserToWorkspace,
  createIssue,
  createTeam,
  createUser,
  createWorkspace,
  seedTestSetup,
} from "../../test/fixtures";
import { createTestDb, type TestDb } from "../../test/setup";

const unknownId = "00000000-0000-0000-0000-000000000000";
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

describe("attachments api", () => {
  let testDb: TestDb;
  let seed: Awaited<ReturnType<typeof seedTestSetup>>;

  beforeEach(async () => {
    rmSync(env.FILES_DIR, { recursive: true, force: true });
    testDb = await createTestDb();
    seed = await seedTestSetup(testDb);
  });

  afterEach(() => {
    rmSync(env.FILES_DIR, { recursive: true, force: true });
  });

  const authed = () => ({ cookie: seed.cookie, workspaceSlug: seed.workspace.slug });

  const issueInSeedTeam = (key = "TES-1") =>
    createIssue(testDb, {
      key,
      keyNumber: Number(key.split("-")[1]),
      workspaceId: seed.workspace.id,
      teamId: seed.team.id,
      createdById: seed.user.id,
    });

  const fileForm = (file: File | null = new File([png], "test.png", { type: "image/png" })) => {
    const form = new FormData();
    if (file !== null) {
      form.append("file", file);
    }
    return form;
  };

  // The in-memory client sends FormData without a multipart content type, so
  // uploads go through the real web handler.
  const upload = async (
    path: string,
    form = fileForm(),
    headers: Record<string, string> = {
      cookie: seed.cookie,
      [WORKSPACE_SLUG_HEADER]: seed.workspace.slug,
    },
  ) => {
    const response = await handleApiRequest(
      new Request(`${env.APP_BASE_URL}/api/issues${path}`, {
        method: "POST",
        headers,
        body: form,
      }),
    );
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  };

  const uploadToIssue = async (issueKey: string, form?: FormData) => {
    const { status, body } = await upload(`/${issueKey}/attachments`, form);
    expect(status).toBe(200);
    return body.attachment as { id: string; issueId: string | null };
  };

  const uploadOrphan = async (form?: FormData) => {
    const { status, body } = await upload("/attachments", form);
    expect(status).toBe(200);
    return body.attachment as { id: string; issueId: string | null };
  };

  const download = (attachmentId: string, cookie: string | null = seed.cookie) =>
    handleApiRequest(
      new Request(`${env.APP_BASE_URL}/api/issues/attachments/${attachmentId}/download`, {
        headers: cookie === null ? {} : { cookie },
      }),
    );

  const storedAttachment = (id: string) =>
    testDb.db.query.issueAttachment.findFirst({ where: { id } });

  const changeEvents = (issueId: string) =>
    testDb.db.query.issueChangeEvent.findMany({ where: { issueId } });

  /** An attachment row and file that some other user uploaded. */
  const insertAttachment = async (input: { issueId: string | null; createdById: string }) => {
    const filePath = join(env.FILES_DIR, `seeded-${crypto.randomUUID()}.png`);
    await Bun.write(filePath, png);
    const [attachment] = await testDb.db
      .insert(dbSchema.issueAttachment)
      .values({
        ...input,
        filePath,
        mimeType: "image/png",
        originalFileName: "seeded.png",
        sizeBytes: png.length,
      })
      .returning();
    return attachment;
  };

  describe("access", () => {
    test("rejects uploads without a session", async () => {
      const { status, body } = await upload("/attachments", fileForm(), {
        [WORKSPACE_SLUG_HEADER]: seed.workspace.slug,
      });

      expect(status).toBe(401);
      expect(body).toMatchObject({ _tag: "Unauthorized", code: "UNAUTHORIZED" });
    });

    test("rejects workspaces the user doesn't belong to", async () => {
      const other = await createWorkspace(testDb, { slug: "private", displayName: "Private" });

      const error = await runApi({ cookie: seed.cookie, workspaceSlug: other.slug }, (client) =>
        Effect.flip(
          client.attachments.get({ params: { issueKey: "TES-1", attachmentId: unknownId } }),
        ),
      );

      expect(error).toMatchObject({ _tag: "NotWorkspaceMember", code: "NOT_WORKSPACE_MEMBER" });
    });

    test("rejects downloads without a session", async () => {
      const attachment = await uploadOrphan();

      const response = await download(attachment.id, null);

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ code: "UNAUTHORIZED" });
    });
  });

  describe("POST /issues/:issueKey/attachments", () => {
    test("stores the file on the issue and records a change event", async () => {
      const issue = await issueInSeedTeam();

      const { status, body } = await upload(`/${issue.key}/attachments`);

      expect(status).toBe(200);
      expect(body.attachment).toMatchObject({
        issueId: issue.id,
        createdById: seed.user.id,
        originalFileName: "test.png",
        mimeType: "image/png",
        sizeBytes: 4,
      });
      expect(body.attachment).not.toHaveProperty("filePath");

      const stored = await storedAttachment(body.attachment.id);
      expect(stored!.filePath).toContain(`workspaces/${seed.workspace.slug}/issue-attachments/`);
      expect(await Bun.file(stored!.filePath).bytes()).toEqual(png);

      const events = await changeEvents(issue.id);
      expect(
        events.some(
          (event) =>
            event.eventType === "attachment_added" && event.attachmentId === body.attachment.id,
        ),
      ).toBe(true);
    });

    test("returns IssueNotFound for an unknown issue without storing the file", async () => {
      const { status, body } = await upload("/TES-999/attachments");

      expect(status).toBe(404);
      expect(body).toMatchObject({ _tag: "IssueNotFound", code: "ISSUE_NOT_FOUND" });
      expect(await testDb.db.query.issueAttachment.findMany()).toHaveLength(0);
      expect(await Bun.file(join(env.FILES_DIR, "workspaces")).exists()).toBe(false);
    });

    test("doesn't reach issues in other workspaces", async () => {
      const other = await createWorkspace(testDb, { slug: "other", displayName: "Other" });
      const otherTeam = await createTeam(testDb, { key: "OTH", workspaceId: other.id });
      await createIssue(testDb, {
        key: "OTH-1",
        keyNumber: 1,
        workspaceId: other.id,
        teamId: otherTeam.id,
        createdById: seed.user.id,
      });

      const { status, body } = await upload("/OTH-1/attachments");

      expect(status).toBe(404);
      expect(body).toMatchObject({ code: "ISSUE_NOT_FOUND" });
    });

    test("requires a file", async () => {
      const issue = await issueInSeedTeam();

      const { status, body } = await upload(`/${issue.key}/attachments`, fileForm(null));

      expect(status).toBe(400);
      expect(body).toMatchObject({
        _tag: "AttachmentFileInvalid",
        code: "FILE_MISSING_OR_INVALID",
      });
    });

    test("keeps path segments in the filename out of the stored path", async () => {
      const issue = await issueInSeedTeam();

      const attachment = await uploadToIssue(
        issue.key,
        fileForm(new File([png], "../../../escape.png", { type: "image/png" })),
      );

      const stored = await storedAttachment(attachment.id);
      const directory = resolve(
        env.FILES_DIR,
        `workspaces/${seed.workspace.slug}/issue-attachments`,
      );
      expect(resolve(stored!.filePath).startsWith(`${directory}/`)).toBe(true);
    });
  });

  describe("POST /issues/attachments", () => {
    test("stores an orphan and schedules its cleanup", async () => {
      const { status, body } = await upload("/attachments");

      expect(status).toBe(200);
      expect(body.attachment).toMatchObject({ issueId: null, originalFileName: "test.png" });

      const job = await testDb.db.query.job.findFirst({
        where: { type: "cleanup-orphan-attachment" },
      });
      expect(JSON.parse(job!.payload)).toEqual({ attachmentId: body.attachment.id });
      expect(job!.runAt!.getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
    });

    test("requires a file", async () => {
      const { status, body } = await upload("/attachments", fileForm(null));

      expect(status).toBe(400);
      expect(body).toMatchObject({ code: "FILE_MISSING_OR_INVALID" });
    });
  });

  describe("POST /issues/:issueKey/attachments/associate", () => {
    test("links the user's orphans and records change events", async () => {
      const issue = await issueInSeedTeam();
      const orphan = await uploadOrphan();

      const response = await runApi(authed(), (client) =>
        client.attachments.associate({
          params: { issueKey: issue.key },
          payload: { attachmentIds: [orphan.id] },
        }),
      );

      expect(response).toEqual({ success: true });
      expect((await storedAttachment(orphan.id))?.issueId).toBe(issue.id);
      const events = await changeEvents(issue.id);
      expect(events.map((event) => [event.eventType, event.attachmentId])).toContainEqual([
        "attachment_added",
        orphan.id,
      ]);
    });

    test("skips orphans other users uploaded", async () => {
      const issue = await issueInSeedTeam();
      const otherUser = await createUser(testDb, { email: "other@example.com" });
      const orphan = await insertAttachment({ issueId: null, createdById: otherUser.id });

      await runApi(authed(), (client) =>
        client.attachments.associate({
          params: { issueKey: issue.key },
          payload: { attachmentIds: [orphan.id] },
        }),
      );

      expect((await storedAttachment(orphan.id))?.issueId).toBeNull();
      expect(await changeEvents(issue.id)).toHaveLength(0);
    });

    test("returns IssueNotFound for an unknown issue", async () => {
      const error = await runApi(authed(), (client) =>
        Effect.flip(
          client.attachments.associate({
            params: { issueKey: "TES-999" },
            payload: { attachmentIds: [unknownId] },
          }),
        ),
      );

      expect(error).toMatchObject({ _tag: "IssueNotFound", code: "ISSUE_NOT_FOUND" });
    });
  });

  describe("GET /issues/:issueKey/attachments/:attachmentId", () => {
    test("returns the attachment", async () => {
      const issue = await issueInSeedTeam();
      const uploaded = await uploadToIssue(issue.key);

      const { attachment } = await runApi(authed(), (client) =>
        client.attachments.get({ params: { issueKey: issue.key, attachmentId: uploaded.id } }),
      );

      expect(attachment.id).toBe(uploaded.id);
      expect(attachment.createdAt).toBeInstanceOf(Date);
    });

    test("returns AttachmentNotFound for an unknown id or another issue's attachment", async () => {
      const issue = await issueInSeedTeam("TES-1");
      const otherIssue = await issueInSeedTeam("TES-2");
      const uploaded = await uploadToIssue(otherIssue.key);

      for (const attachmentId of [unknownId, uploaded.id]) {
        const error = await runApi(authed(), (client) =>
          Effect.flip(client.attachments.get({ params: { issueKey: issue.key, attachmentId } })),
        );
        expect(error).toMatchObject({ _tag: "AttachmentNotFound", code: "ATTACHMENT_NOT_FOUND" });
      }
    });

    test("returns IssueNotFound for an unknown issue", async () => {
      const error = await runApi(authed(), (client) =>
        Effect.flip(
          client.attachments.get({ params: { issueKey: "TES-999", attachmentId: unknownId } }),
        ),
      );

      expect(error).toMatchObject({ code: "ISSUE_NOT_FOUND" });
    });
  });

  describe("DELETE /issues/:issueKey/attachments/:attachmentId", () => {
    test("deletes the row and the file and records a change event", async () => {
      const issue = await issueInSeedTeam();
      const uploaded = await uploadToIssue(issue.key);
      const { filePath } = (await storedAttachment(uploaded.id))!;

      const response = await runApi(authed(), (client) =>
        client.attachments.delete({ params: { issueKey: issue.key, attachmentId: uploaded.id } }),
      );

      expect(response).toEqual({ message: "Attachment deleted" });
      expect(await storedAttachment(uploaded.id)).toBeUndefined();
      expect(await Bun.file(filePath).exists()).toBe(false);
      // The event's attachment id is nulled once the attachment row is gone.
      const events = await changeEvents(issue.id);
      expect(events.map((event) => event.eventType)).toContain("attachment_removed");
    });

    test("returns AttachmentNotFound for an unknown attachment", async () => {
      const issue = await issueInSeedTeam();

      const error = await runApi(authed(), (client) =>
        Effect.flip(
          client.attachments.delete({ params: { issueKey: issue.key, attachmentId: unknownId } }),
        ),
      );

      expect(error).toMatchObject({ _tag: "AttachmentNotFound", code: "ATTACHMENT_NOT_FOUND" });
    });
  });

  describe("GET /issues/attachments/:attachmentId/download", () => {
    test("streams the file inline without a workspace header", async () => {
      const issue = await issueInSeedTeam();
      const uploaded = await uploadToIssue(issue.key);

      const response = await download(uploaded.id);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/png");
      expect(response.headers.get("content-disposition")).toBe('inline; filename="test.png"');
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
    });

    test("serves downloads through the app shell", async () => {
      const uploaded = await uploadOrphan();

      const response = await app.fetch(
        new Request(`${env.APP_BASE_URL}/api/issues/attachments/${uploaded.id}/download`, {
          headers: { cookie: seed.cookie },
        }),
      );

      expect(response.status).toBe(200);
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
    });

    test("lets any workspace member download issue attachments", async () => {
      const issue = await issueInSeedTeam();
      const uploader = await createUser(testDb, { email: "uploader@example.com" });
      await addUserToWorkspace(testDb, { userId: uploader.id, workspaceId: seed.workspace.id });
      const attachment = await insertAttachment({ issueId: issue.id, createdById: uploader.id });

      const response = await download(attachment.id);

      expect(response.status).toBe(200);
    });

    test("hides other users' orphans and other workspaces' attachments", async () => {
      const otherUser = await createUser(testDb, { email: "other@example.com" });
      const orphan = await insertAttachment({ issueId: null, createdById: otherUser.id });
      const other = await createWorkspace(testDb, { slug: "other", displayName: "Other" });
      const otherTeam = await createTeam(testDb, { key: "OTH", workspaceId: other.id });
      const otherIssue = await createIssue(testDb, {
        key: "OTH-1",
        keyNumber: 1,
        workspaceId: other.id,
        teamId: otherTeam.id,
        createdById: otherUser.id,
      });
      const foreign = await insertAttachment({ issueId: otherIssue.id, createdById: otherUser.id });

      for (const id of [orphan.id, foreign.id, unknownId]) {
        const response = await download(id);
        expect(response.status).toBe(404);
        expect(await response.json()).toMatchObject({
          _tag: "AttachmentNotFound",
          code: "ATTACHMENT_NOT_FOUND",
        });
      }
    });

    test("returns AttachmentFileNotFound when the file is gone", async () => {
      const uploaded = await uploadOrphan();
      rmSync((await storedAttachment(uploaded.id))!.filePath);

      const response = await download(uploaded.id);

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({
        _tag: "AttachmentFileNotFound",
        code: "ATTACHMENT_FILE_NOT_FOUND",
      });
    });

    test("serves types that could run scripts as downloads", async () => {
      const uploaded = await uploadOrphan(
        fileForm(new File(["<script>alert(1)</script>"], "page.html", { type: "text/html" })),
      );

      const response = await download(uploaded.id);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-disposition")).toBe('attachment; filename="page.html"');
    });
  });

  describe("orphan cleanup job", () => {
    const cleanup = (attachmentId: string) =>
      runtime.runPromise(
        AttachmentService.use((attachments) =>
          attachments.cleanupOrphanAttachment({ attachmentId }),
        ),
      );

    test("deletes an orphan that was never linked, with its file", async () => {
      const orphan = await uploadOrphan();
      const { filePath } = (await storedAttachment(orphan.id))!;

      await cleanup(orphan.id);

      expect(await storedAttachment(orphan.id)).toBeUndefined();
      expect(await Bun.file(filePath).exists()).toBe(false);
    });

    test("keeps an attachment linked to an issue before cleanup ran", async () => {
      const issue = await issueInSeedTeam();
      const orphan = await uploadOrphan();
      const { filePath } = (await storedAttachment(orphan.id))!;
      await runApi(authed(), (client) =>
        client.attachments.associate({
          params: { issueKey: issue.key },
          payload: { attachmentIds: [orphan.id] },
        }),
      );

      await cleanup(orphan.id);

      expect((await storedAttachment(orphan.id))?.issueId).toBe(issue.id);
      expect(await Bun.file(filePath).exists()).toBe(true);
    });
  });
});
