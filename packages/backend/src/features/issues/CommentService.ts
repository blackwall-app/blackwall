import { Database } from "@blackwall/database/effect";
import type { IssueComment } from "@blackwall/database/schema";
import { jobService } from "@blackwall/queue";
import { CommentNotFound, IssueNotFound } from "@blackwall/shared";
import type { JSONContent } from "@tiptap/core";
import { Context, Effect, Layer } from "effect";
import { commentData } from "./comment.data";
import { IssueService } from "./IssueService";

/**
 * Any workspace member can comment on or delete comments of any issue in the
 * workspace. Neither team membership nor authorship is checked.
 */
export class CommentService extends Context.Service<
  CommentService,
  {
    /** Also queues a `comment-email` job for the assignee, unless they wrote the comment. */
    readonly createComment: (input: {
      workspaceId: string;
      issueKey: string;
      authorId: string;
      content: JSONContent;
    }) => Effect.Effect<IssueComment, IssueNotFound>;
    /** Soft deletes the comment. */
    readonly deleteComment: (input: {
      workspaceId: string;
      issueKey: string;
      commentId: string;
      actorId: string;
    }) => Effect.Effect<void, IssueNotFound | CommentNotFound>;
  }
>()("blackwall/CommentService") {
  static readonly layer = Layer.effect(
    CommentService,
    Effect.gen(function* () {
      const database = yield* Database;
      const issues = yield* IssueService;

      const createComment = Effect.fn("CommentService.createComment")(
        function* (input: {
          workspaceId: string;
          issueKey: string;
          authorId: string;
          content: JSONContent;
        }) {
          const issue = yield* issues.requireIssue(input);
          const comment = yield* database.transaction((tx) =>
            commentData.insertComment(tx, {
              issue,
              authorId: input.authorId,
              content: input.content,
            }),
          );

          const recipientIds =
            issue.assignedToId && issue.assignedToId !== input.authorId ? [issue.assignedToId] : [];
          yield* Effect.tryPromise(() =>
            jobService.addJob({
              type: "comment-email",
              payload: { commentId: comment.id, recipientIds },
            }),
          ).pipe(Effect.orDie);

          return comment;
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const deleteComment = Effect.fn("CommentService.deleteComment")(
        function* (input: {
          workspaceId: string;
          issueKey: string;
          commentId: string;
          actorId: string;
        }) {
          const issue = yield* issues.requireIssue(input);
          const comment = yield* database.use((db) =>
            commentData.getCommentById({ commentId: input.commentId, issueId: issue.id }, db),
          );
          if (comment === undefined) {
            return yield* new CommentNotFound();
          }
          yield* database.transaction((tx) =>
            commentData.softDeleteComment(tx, {
              commentId: comment.id,
              issue,
              actorId: input.actorId,
            }),
          );
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      return CommentService.of({ createComment, deleteComment });
    }),
  );
}
