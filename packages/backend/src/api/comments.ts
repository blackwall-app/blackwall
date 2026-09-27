import { Api, CurrentUser, CurrentWorkspace } from "@blackwall/shared";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { CommentService } from "../features/issues/CommentService";

export const CommentsHandlers = HttpApiBuilder.group(
  Api,
  "comments",
  Effect.fn(function* (handlers) {
    const comments = yield* CommentService;

    return handlers.handleAll({
      create: ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const workspace = yield* CurrentWorkspace;
          const comment = yield* comments.createComment({
            workspaceId: workspace.id,
            issueKey: params.issueKey,
            authorId: user.id,
            content: payload.content,
          });
          return { comment };
        }),
      delete: ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const workspace = yield* CurrentWorkspace;
          yield* comments.deleteComment({
            workspaceId: workspace.id,
            issueKey: params.issueKey,
            commentId: params.commentId,
            actorId: user.id,
          });
          return { message: "Comment deleted" };
        }),
    });
  }),
);
