import "../../test/env.test";
import { beforeEach, describe, expect, test } from "bun:test";
import { dbSchema } from "@blackwall/database";
import type { JSONContent } from "@tiptap/core";
import { Effect } from "effect";
import { runApi } from "../../test/api";
import {
  createIssue,
  createTeam,
  createUser,
  createWorkspace,
  seedTestSetup,
} from "../../test/fixtures";
import { createTestDb, type TestDb } from "../../test/setup";

const hello: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
};

const unknownId = "00000000-0000-0000-0000-000000000000";

describe("comments api", () => {
  let testDb: TestDb;
  let seed: Awaited<ReturnType<typeof seedTestSetup>>;

  beforeEach(async () => {
    testDb = await createTestDb();
    seed = await seedTestSetup(testDb);
  });

  const authed = () => ({ cookie: seed.cookie, workspaceSlug: seed.workspace.slug });

  const issueInSeedTeam = (key: string, assignedToId: string | null = null) =>
    createIssue(testDb, {
      key,
      keyNumber: Number(key.split("-")[1]),
      workspaceId: seed.workspace.id,
      teamId: seed.team.id,
      createdById: seed.user.id,
      assignedToId,
    });

  const comment = (issueKey: string) =>
    runApi(authed(), (client) =>
      client.comments.create({ params: { issueKey }, payload: { content: hello } }),
    ).then((response) => response.comment);

  const commentEmailJobs = async () => {
    const jobs = await testDb.db.select().from(dbSchema.job);
    return jobs
      .filter((job) => job.type === "comment-email")
      .map((job) => JSON.parse(job.payload) as { commentId: string; recipientIds: string[] });
  };

  test("rejects requests without a session", async () => {
    const issue = await issueInSeedTeam("TES-1");

    const error = await runApi({ workspaceSlug: seed.workspace.slug }, (client) =>
      Effect.flip(
        client.comments.create({ params: { issueKey: issue.key }, payload: { content: hello } }),
      ),
    );

    expect(error).toMatchObject({ _tag: "Unauthorized", code: "UNAUTHORIZED" });
  });

  test("creates a comment and records the event", async () => {
    const issue = await issueInSeedTeam("TES-1");

    const created = await comment(issue.key);

    expect(created).toMatchObject({
      issueId: issue.id,
      authorId: seed.user.id,
      content: hello,
      deletedAt: null,
    });
    expect(created.createdAt).toBeInstanceOf(Date);
    const events = await testDb.db.query.issueChangeEvent.findMany({
      where: { issueId: issue.id, eventType: "comment_added" },
    });
    expect(events.map((event) => event.commentId)).toEqual([created.id]);
  });

  test("queues an email to the assignee when someone else comments", async () => {
    const assignee = await createUser(testDb, { email: "assignee@example.com" });
    const issue = await issueInSeedTeam("TES-1", assignee.id);

    const created = await comment(issue.key);

    expect(await commentEmailJobs()).toEqual([
      { commentId: created.id, recipientIds: [assignee.id] },
    ]);
  });

  test("queues the email job without recipients when the assignee comments", async () => {
    const issue = await issueInSeedTeam("TES-1", seed.user.id);

    const created = await comment(issue.key);

    expect(await commentEmailJobs()).toEqual([{ commentId: created.id, recipientIds: [] }]);
  });

  test("reports comments on unknown issues", async () => {
    const error = await runApi(authed(), (client) =>
      Effect.flip(
        client.comments.create({ params: { issueKey: "TES-999" }, payload: { content: hello } }),
      ),
    );

    expect(error).toMatchObject({ _tag: "IssueNotFound", code: "ISSUE_NOT_FOUND" });
  });

  test("allows comments on issues of teams the user isn't in", async () => {
    const otherTeam = await createTeam(testDb, { key: "OTH", workspaceId: seed.workspace.id });
    const issue = await createIssue(testDb, {
      key: "OTH-1",
      keyNumber: 1,
      workspaceId: seed.workspace.id,
      teamId: otherTeam.id,
      createdById: seed.user.id,
    });

    const created = await comment(issue.key);

    expect(created.issueId).toBe(issue.id);
  });

  test("deletes a comment softly and records the event", async () => {
    const issue = await issueInSeedTeam("TES-1");
    const created = await comment(issue.key);

    const result = await runApi(authed(), (client) =>
      client.comments.delete({ params: { issueKey: issue.key, commentId: created.id } }),
    );

    expect(result).toEqual({ message: "Comment deleted" });
    const stored = await testDb.db.query.issueComment.findFirst({ where: { id: created.id } });
    expect(stored?.deletedAt).toBeInstanceOf(Date);
    const events = await testDb.db.query.issueChangeEvent.findMany({
      where: { issueId: issue.id, eventType: "comment_deleted" },
    });
    expect(events.map((event) => event.actorId)).toEqual([seed.user.id]);
  });

  test("reports unknown, deleted, and mismatched comments", async () => {
    const issue = await issueInSeedTeam("TES-1");
    const otherIssue = await issueInSeedTeam("TES-2");
    const deleted = await comment(issue.key);
    const onOtherIssue = await comment(otherIssue.key);
    await runApi(authed(), (client) =>
      client.comments.delete({ params: { issueKey: issue.key, commentId: deleted.id } }),
    );

    const deleteComment = (commentId: string) =>
      runApi(authed(), (client) =>
        Effect.flip(client.comments.delete({ params: { issueKey: issue.key, commentId } })),
      );

    expect(await deleteComment(unknownId)).toMatchObject({
      _tag: "CommentNotFound",
      code: "COMMENT_NOT_FOUND",
    });
    expect((await deleteComment(deleted.id))._tag).toBe("CommentNotFound");
    expect((await deleteComment(onOtherIssue.id))._tag).toBe("CommentNotFound");
  });

  test("reports deleting on unknown issues", async () => {
    const error = await runApi(authed(), (client) =>
      Effect.flip(
        client.comments.delete({ params: { issueKey: "TES-999", commentId: unknownId } }),
      ),
    );

    expect(error).toMatchObject({ _tag: "IssueNotFound", code: "ISSUE_NOT_FOUND" });
  });

  test("can't reach issues or comments of another workspace", async () => {
    const other = await createWorkspace(testDb, { slug: "other", displayName: "Other" });
    const otherTeam = await createTeam(testDb, { key: "OTH", workspaceId: other.id });
    const foreignIssue = await createIssue(testDb, {
      key: "OTH-1",
      keyNumber: 1,
      workspaceId: other.id,
      teamId: otherTeam.id,
      createdById: seed.user.id,
    });
    const [foreignComment] = await testDb.db
      .insert(dbSchema.issueComment)
      .values({ issueId: foreignIssue.id, authorId: seed.user.id, content: hello })
      .returning();

    const created = await runApi(authed(), (client) =>
      Effect.flip(
        client.comments.create({
          params: { issueKey: foreignIssue.key },
          payload: { content: hello },
        }),
      ),
    );
    const deleted = await runApi(authed(), (client) =>
      Effect.flip(
        client.comments.delete({
          params: { issueKey: foreignIssue.key, commentId: foreignComment.id },
        }),
      ),
    );

    expect(created._tag).toBe("IssueNotFound");
    expect(deleted._tag).toBe("IssueNotFound");
    const stored = await testDb.db.query.issueComment.findFirst({
      where: { id: foreignComment.id },
    });
    expect(stored?.deletedAt).toBeNull();
  });
});
